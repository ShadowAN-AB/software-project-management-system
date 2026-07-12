import { differenceInDays, isPast, isToday, isTomorrow } from "date-fns";

export type DueDateStatus = "overdue" | "today" | "tomorrow" | "soon" | "normal" | "none";

export function getDueDateStatus(dueDate: Date | string | null | undefined): DueDateStatus {
  if (!dueDate) return "none";
  const date = typeof dueDate === "string" ? new Date(dueDate) : dueDate;

  if (isToday(date)) return "today";
  if (isPast(date)) return "overdue";
  if (isTomorrow(date)) return "tomorrow";
  if (differenceInDays(date, new Date()) <= 3) return "soon";
  return "normal";
}

export const DUE_DATE_CONFIG: Record<
  DueDateStatus,
  { label: string; className: string; dotColor: string }
> = {
  overdue: {
    label: "Overdue",
    className: "text-red-600 bg-red-50 border-red-200",
    dotColor: "bg-red-500",
  },
  today: {
    label: "Due today",
    className: "text-amber-600 bg-amber-50 border-amber-200",
    dotColor: "bg-amber-500",
  },
  tomorrow: {
    label: "Due tomorrow",
    className: "text-orange-600 bg-orange-50 border-orange-200",
    dotColor: "bg-orange-500",
  },
  soon: {
    label: "Due soon",
    className: "text-blue-600 bg-blue-50 border-blue-200",
    dotColor: "bg-blue-500",
  },
  normal: {
    label: "",
    className: "text-zinc-500",
    dotColor: "bg-zinc-300",
  },
  none: {
    label: "",
    className: "text-zinc-400",
    dotColor: "bg-zinc-200",
  },
};
