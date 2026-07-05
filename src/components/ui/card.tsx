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
      className={`bg-white dark:bg-zinc-800/50 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 shadow-sm ${
        hoverable
          ? "transition-all duration-200 hover:shadow-md hover:border-zinc-300 hover:-translate-y-0.5"
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
      className={`px-6 py-4 border-b border-zinc-100 dark:border-zinc-700 ${className}`}
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
