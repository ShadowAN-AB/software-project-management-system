import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM || "PMS <noreply@pms.dev>";
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

async function sendEmail({ to, subject, html }: EmailPayload) {
  if (!resend) return;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html: wrapInLayout(subject, html),
    });
  } catch {
    // Silently fail — email is best-effort, not critical
  }
}

function wrapInLayout(title: string, body: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="border-bottom: 1px solid #e4e4e7; padding-bottom: 16px; margin-bottom: 20px;">
        <span style="font-size: 18px; font-weight: 700; color: #09090b;">PMS</span>
      </div>
      ${body}
      <div style="border-top: 1px solid #e4e4e7; padding-top: 16px; margin-top: 24px;">
        <p style="font-size: 12px; color: #a1a1aa; margin: 0;">
          You received this because of your notification settings in PMS.
        </p>
      </div>
    </div>
  `;
}

function taskLink(taskId: string): string {
  return `${APP_URL}/tasks/${taskId}`;
}

function projectLink(projectId: string): string {
  return `${APP_URL}/projects/${projectId}`;
}

export async function sendTaskAssignedEmail(
  to: string,
  assignerName: string,
  taskTitle: string,
  taskId: string,
  projectName: string
) {
  await sendEmail({
    to,
    subject: `[${projectName}] Task assigned: ${taskTitle}`,
    html: `
      <p style="font-size: 14px; color: #3f3f46; margin: 0 0 12px;">
        <strong>${assignerName}</strong> assigned you a task:
      </p>
      <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <p style="font-size: 15px; font-weight: 600; color: #09090b; margin: 0;">${taskTitle}</p>
        <p style="font-size: 13px; color: #71717a; margin: 4px 0 0;">${projectName}</p>
      </div>
      <a href="${taskLink(taskId)}" style="display: inline-block; background: #09090b; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500;">
        View Task
      </a>
    `,
  });
}

export async function sendTaskStatusEmail(
  to: string,
  changerName: string,
  taskTitle: string,
  taskId: string,
  oldStatus: string,
  newStatus: string,
  projectName: string
) {
  const formatStatus = (s: string) => s.replace(/_/g, " ").toLowerCase();
  await sendEmail({
    to,
    subject: `[${projectName}] ${taskTitle} → ${formatStatus(newStatus)}`,
    html: `
      <p style="font-size: 14px; color: #3f3f46; margin: 0 0 12px;">
        <strong>${changerName}</strong> changed the status of <strong>${taskTitle}</strong>:
      </p>
      <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <span style="font-size: 13px; color: #71717a; text-decoration: line-through;">${formatStatus(oldStatus)}</span>
        <span style="font-size: 13px; color: #71717a; margin: 0 8px;">→</span>
        <span style="font-size: 13px; font-weight: 600; color: #09090b;">${formatStatus(newStatus)}</span>
      </div>
      <a href="${taskLink(taskId)}" style="display: inline-block; background: #09090b; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500;">
        View Task
      </a>
    `,
  });
}

export async function sendCommentEmail(
  to: string,
  commenterName: string,
  taskTitle: string,
  taskId: string,
  commentPreview: string,
  projectName: string
) {
  await sendEmail({
    to,
    subject: `[${projectName}] New comment on: ${taskTitle}`,
    html: `
      <p style="font-size: 14px; color: #3f3f46; margin: 0 0 12px;">
        <strong>${commenterName}</strong> commented on <strong>${taskTitle}</strong>:
      </p>
      <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 16px; border-left: 3px solid #3b82f6;">
        <p style="font-size: 13px; color: #3f3f46; margin: 0; white-space: pre-wrap;">${commentPreview}</p>
      </div>
      <a href="${taskLink(taskId)}" style="display: inline-block; background: #09090b; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500;">
        View Comment
      </a>
    `,
  });
}

export async function sendProjectAddedEmail(
  to: string,
  adderName: string,
  projectName: string,
  projectId: string
) {
  await sendEmail({
    to,
    subject: `You've been added to ${projectName}`,
    html: `
      <p style="font-size: 14px; color: #3f3f46; margin: 0 0 12px;">
        <strong>${adderName}</strong> added you to the project <strong>${projectName}</strong>.
      </p>
      <a href="${projectLink(projectId)}" style="display: inline-block; background: #09090b; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500;">
        View Project
      </a>
    `,
  });
}

export async function sendDueSoonEmail(
  to: string,
  taskTitle: string,
  taskId: string,
  dueDate: string,
  projectName: string
) {
  await sendEmail({
    to,
    subject: `[${projectName}] Due soon: ${taskTitle}`,
    html: `
      <p style="font-size: 14px; color: #3f3f46; margin: 0 0 12px;">
        Your task is due on <strong>${dueDate}</strong>:
      </p>
      <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <p style="font-size: 15px; font-weight: 600; color: #92400e; margin: 0;">${taskTitle}</p>
        <p style="font-size: 13px; color: #b45309; margin: 4px 0 0;">${projectName}</p>
      </div>
      <a href="${taskLink(taskId)}" style="display: inline-block; background: #09090b; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500;">
        View Task
      </a>
    `,
  });
}

export async function sendOverdueEmail(
  to: string,
  taskTitle: string,
  taskId: string,
  dueDate: string,
  projectName: string
) {
  await sendEmail({
    to,
    subject: `[${projectName}] Overdue: ${taskTitle}`,
    html: `
      <p style="font-size: 14px; color: #3f3f46; margin: 0 0 12px;">
        Your task was due on <strong>${dueDate}</strong> and is now overdue:
      </p>
      <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <p style="font-size: 15px; font-weight: 600; color: #991b1b; margin: 0;">${taskTitle}</p>
        <p style="font-size: 13px; color: #dc2626; margin: 4px 0 0;">${projectName}</p>
      </div>
      <a href="${taskLink(taskId)}" style="display: inline-block; background: #09090b; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500;">
        View Task
      </a>
    `,
  });
}
