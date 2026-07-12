import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks -----------------------------------------------------------

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

const mockGetReportsData = vi.fn();
vi.mock("@/services/reports-actions", () => ({ getReportsData: mockGetReportsData }));

// --- Helpers ---------------------------------------------------------

async function loadRoute() {
  return import("@/app/api/export/reports/route");
}

function sampleData() {
  return {
    tasksByStatus: { TODO: 3, IN_PROGRESS: 2, DONE: 5 },
    tasksByPriority: { LOW: 1, MEDIUM: 4, HIGH: 3, CRITICAL: 2 },
    tasksByType: { TASK: 6, BUG: 2, FEATURE: 2 },
    projectsByStatus: { ACTIVE: 1 },
    dailyTrend: [],
    topAssignees: [
      { name: "Alice", count: 4 },
      { name: "Bob", count: 2 },
    ],
    sprintStats: [
      { name: "Sprint 1", project: "PMS", total: 10, completed: 5, status: "ACTIVE" },
    ],
    overdueTasks: 1,
  };
}

// --- Tests -----------------------------------------------------------

describe("GET /api/export/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    const { GET } = await loadRoute();
    mockAuth.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockGetReportsData).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 404 when reports data is null", async () => {
    const { GET } = await loadRoute();
    mockAuth.mockResolvedValue({ user: { id: "u1", name: "Alice" } });
    mockGetReportsData.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "No data" });
  });

  it("returns a valid PDF with correct headers on success", async () => {
    const { GET } = await loadRoute();
    mockAuth.mockResolvedValue({ user: { id: "u1", name: "Alice" } });
    mockGetReportsData.mockResolvedValue(sampleData());

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");

    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toMatch(/^attachment; filename="pms_reports_\d{4}-\d{2}-\d{2}\.pdf"$/);

    const buf = Buffer.from(await res.arrayBuffer());
    // PDF magic header
    expect(buf.slice(0, 5).toString("ascii")).toBe("%PDF-");
    // EOF marker (allow trailing whitespace/newline)
    expect(buf.slice(-8).toString("ascii")).toContain("%%EOF");
    // Metadata written into the PDF info dict
    const asString = buf.toString("latin1");
    expect(asString).toContain("PMS Reports");
    expect(asString).toContain("Alice");
  });

  it("handles empty sections without throwing", async () => {
    const { GET } = await loadRoute();
    mockAuth.mockResolvedValue({ user: { id: "u1", name: null } });
    mockGetReportsData.mockResolvedValue({
      tasksByStatus: {},
      tasksByPriority: {},
      tasksByType: {},
      projectsByStatus: {},
      dailyTrend: [],
      topAssignees: [],
      sprintStats: [],
      overdueTasks: 0,
    });

    const res = await GET();

    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
