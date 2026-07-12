import { auth } from "@/lib/auth";
import { getReportsData } from "@/services/reports-actions";
import { NextResponse } from "next/server";
import { format } from "date-fns";
// pdfkit reads AFM font files from disk relative to its own dir, which breaks
// under Turbopack. The standalone build has the standard 14 fonts embedded.
import PDFDocument from "pdfkit/js/pdfkit.standalone";

export const runtime = "nodejs";

const STATUS_ORDER = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const PRIORITY_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const TYPE_ORDER = ["TASK", "FEATURE", "BUG", "IMPROVEMENT"];

function label(key: string) {
  return key
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getReportsData();
  if (!data) {
    return NextResponse.json({ error: "No data" }, { status: 404 });
  }

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    info: {
      Title: "PMS Reports",
      Author: session.user.name ?? "PMS",
      CreationDate: new Date(),
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // Colors — monochrome zinc scale
  const zinc900 = "#18181b";
  const zinc700 = "#3f3f46";
  const zinc500 = "#71717a";
  const zinc300 = "#d4d4d8";
  const zinc100 = "#f4f4f5";

  // --- Header
  doc.fillColor(zinc900).fontSize(20).font("Helvetica-Bold").text("Reports & Analytics");
  doc
    .moveDown(0.3)
    .fillColor(zinc500)
    .fontSize(10)
    .font("Helvetica")
    .text(`Generated ${format(new Date(), "MMM d, yyyy 'at' h:mma")} by ${session.user.name ?? "Unknown"}`);
  doc.moveDown(1.2);

  // --- Summary numbers (Completed / In Progress / Overdue / Active members)
  const summary = [
    { label: "Completed", value: data.tasksByStatus.DONE ?? 0 },
    { label: "In progress", value: data.tasksByStatus.IN_PROGRESS ?? 0 },
    { label: "Overdue", value: data.overdueTasks },
    { label: "Active members", value: data.topAssignees.length },
  ];

  const summaryY = doc.y;
  const summaryColWidth = (doc.page.width - 112) / summary.length;
  summary.forEach((card, i) => {
    const x = 56 + i * summaryColWidth;
    doc
      .fillColor(zinc500)
      .fontSize(9)
      .font("Helvetica")
      .text(card.label.toUpperCase(), x, summaryY, { width: summaryColWidth });
    doc
      .fillColor(zinc900)
      .fontSize(22)
      .font("Helvetica-Bold")
      .text(String(card.value), x, summaryY + 14, { width: summaryColWidth });
  });
  doc.y = summaryY + 50;

  // Helper: horizontal bar row with label + value + bar
  function drawBarSection(title: string, entries: [string, number][]) {
    const total = entries.reduce((a, [, v]) => a + v, 0);
    const max = Math.max(...entries.map(([, v]) => v), 1);

    doc
      .moveDown(0.6)
      .fillColor(zinc900)
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(title);
    doc.moveDown(0.4);

    const barX = 200;
    const barMaxWidth = doc.page.width - 56 - barX - 80;
    for (const [key, value] of entries) {
      const y = doc.y;
      const pct = total > 0 ? Math.round((value / total) * 100) : 0;
      doc
        .fillColor(zinc700)
        .fontSize(10)
        .font("Helvetica")
        .text(label(key), 56, y, { width: 140 });
      // Track
      doc.rect(barX, y + 3, barMaxWidth, 6).fillColor(zinc100).fill();
      // Fill
      const w = (value / max) * barMaxWidth;
      if (w > 0) {
        doc.rect(barX, y + 3, w, 6).fillColor(zinc900).fill();
      }
      doc
        .fillColor(zinc500)
        .fontSize(9)
        .font("Helvetica")
        .text(`${value} (${pct}%)`, barX + barMaxWidth + 6, y, { width: 70, align: "right" });
      doc.moveDown(0.6);
    }
  }

  // --- Tasks by Status
  drawBarSection(
    "Tasks by status",
    STATUS_ORDER.filter((s) => (data.tasksByStatus[s] ?? 0) > 0).map(
      (s) => [s, data.tasksByStatus[s] ?? 0] as [string, number]
    )
  );

  // --- Tasks by Priority
  drawBarSection(
    "Tasks by priority",
    PRIORITY_ORDER.filter((p) => (data.tasksByPriority[p] ?? 0) > 0).map(
      (p) => [p, data.tasksByPriority[p] ?? 0] as [string, number]
    )
  );

  // --- Tasks by Type
  drawBarSection(
    "Tasks by type",
    TYPE_ORDER.filter((t) => (data.tasksByType[t] ?? 0) > 0).map(
      (t) => [t, data.tasksByType[t] ?? 0] as [string, number]
    )
  );

  // --- Top team members
  if (data.topAssignees.length > 0) {
    doc
      .moveDown(0.6)
      .fillColor(zinc900)
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Top team members");
    doc.moveDown(0.4);
    const maxCount = data.topAssignees[0]?.count ?? 1;
    const barX = 200;
    const barMaxWidth = doc.page.width - 56 - barX - 80;
    for (const a of data.topAssignees) {
      const y = doc.y;
      doc.fillColor(zinc700).fontSize(10).font("Helvetica").text(a.name, 56, y, { width: 140 });
      doc.rect(barX, y + 3, barMaxWidth, 6).fillColor(zinc100).fill();
      const w = (a.count / maxCount) * barMaxWidth;
      if (w > 0) doc.rect(barX, y + 3, w, 6).fillColor(zinc900).fill();
      doc
        .fillColor(zinc500)
        .fontSize(9)
        .font("Helvetica")
        .text(`${a.count} tasks`, barX + barMaxWidth + 6, y, { width: 70, align: "right" });
      doc.moveDown(0.6);
    }
  }

  // --- Sprint health
  if (data.sprintStats.length > 0) {
    doc.moveDown(0.6);
    if (doc.y > doc.page.height - 200) doc.addPage();
    doc.fillColor(zinc900).fontSize(12).font("Helvetica-Bold").text("Sprint health");
    doc.moveDown(0.4);
    for (const s of data.sprintStats) {
      if (doc.y > doc.page.height - 100) doc.addPage();
      const y = doc.y;
      const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
      doc.fillColor(zinc900).fontSize(10).font("Helvetica-Bold").text(s.name, 56, y);
      doc
        .fillColor(zinc500)
        .fontSize(9)
        .font("Helvetica")
        .text(`${s.project} · ${s.completed}/${s.total} tasks · ${pct}%`, 56, y + 12);
      const trackY = y + 26;
      const trackWidth = doc.page.width - 112;
      doc.rect(56, trackY, trackWidth, 4).fillColor(zinc100).fill();
      if (pct > 0) doc.rect(56, trackY, (pct / 100) * trackWidth, 4).fillColor(zinc900).fill();
      doc.y = trackY + 14;
      doc.moveDown(0.3);
    }
  }

  // Footer
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc
      .fillColor(zinc300)
      .fontSize(8)
      .font("Helvetica")
      .text(
        `PMS · Reports · Page ${i + 1} of ${pageCount}`,
        56,
        doc.page.height - 40,
        { width: doc.page.width - 112, align: "center" }
      );
  }

  doc.end();
  const buffer = await done;

  const filename = `pms_reports_${format(new Date(), "yyyy-MM-dd")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
