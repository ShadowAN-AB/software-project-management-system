import { getInitials } from "@/lib/format";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<Size, { box: string; text: string }> = {
  xs: { box: "h-5 w-5", text: "text-[9px]" },
  sm: { box: "h-7 w-7", text: "text-[10px]" },
  md: { box: "h-8 w-8", text: "text-[10px]" },
  lg: { box: "h-9 w-9", text: "text-xs" },
  xl: { box: "h-16 w-16", text: "text-xl" },
};

export function Avatar({
  name,
  size = "md",
  title,
  className = "",
}: {
  name: string | null | undefined;
  size?: Size;
  title?: string;
  className?: string;
}) {
  const s = sizeClasses[size];
  return (
    <div
      className={`${s.box} rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center flex-shrink-0 ${className}`}
      title={title ?? name ?? undefined}
    >
      <span className={`${s.text} font-semibold text-zinc-700 dark:text-zinc-300`}>
        {getInitials(name)}
      </span>
    </div>
  );
}
