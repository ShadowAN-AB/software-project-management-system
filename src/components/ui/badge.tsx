import { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "purple";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-zinc-100 text-zinc-600 ring-zinc-200/60",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  warning: "bg-amber-50 text-amber-700 ring-amber-200/60",
  danger: "bg-red-50 text-red-700 ring-red-200/60",
  info: "bg-blue-50 text-blue-700 ring-blue-200/60",
  purple: "bg-violet-50 text-violet-700 ring-violet-200/60",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-zinc-400",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-blue-500",
  purple: "bg-violet-500",
};

export function Badge({
  children,
  variant = "default",
  className = "",
  dot = false,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${variantClasses[variant]} ${className}`}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    BACKLOG: { label: "Backlog", variant: "default" },
    TODO: { label: "To Do", variant: "info" },
    IN_PROGRESS: { label: "In Progress", variant: "warning" },
    IN_REVIEW: { label: "In Review", variant: "purple" },
    DONE: { label: "Done", variant: "success" },
    PLANNING: { label: "Planning", variant: "default" },
    ACTIVE: { label: "Active", variant: "success" },
    ON_HOLD: { label: "On Hold", variant: "warning" },
    COMPLETED: { label: "Completed", variant: "success" },
    ARCHIVED: { label: "Archived", variant: "default" },
  };
  const { label, variant } = map[status] ?? {
    label: status,
    variant: "default" as BadgeVariant,
  };
  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    LOW: { label: "Low", variant: "default" },
    MEDIUM: { label: "Medium", variant: "info" },
    HIGH: { label: "High", variant: "warning" },
    CRITICAL: { label: "Critical", variant: "danger" },
  };
  const { label, variant } = map[priority] ?? {
    label: priority,
    variant: "default" as BadgeVariant,
  };
  return <Badge variant={variant}>{label}</Badge>;
}
