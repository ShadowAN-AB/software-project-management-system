import { ReactNode } from "react";

export function Card({
  children,
  className = "",
  hoverable = false,
}: {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
}) {
  return (
    <div
      className={`bg-white dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] ${
        hoverable
          ? "transition-all duration-200 hover:shadow-[0_4px_16px_rgb(0_0_0_/_0.06)] hover:border-zinc-300 dark:hover:border-zinc-700 hover:-translate-y-0.5"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`px-6 py-4 border-b border-zinc-100/70 dark:border-zinc-800 ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {children}
    </div>
  );
}

export function CardContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}
