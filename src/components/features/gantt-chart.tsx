"use client";

import { useMemo, useRef, useState } from "react";
import {
  addDays,
  differenceInDays,
  format,
  startOfWeek,
  endOfWeek,
  isWeekend,
  isSameMonth,
} from "date-fns";
import { PriorityBadge } from "@/components/ui/badge";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  dueDate: Date | null;
  createdAt: Date;
  assignee: { id: string; name: string } | null;
  sprintId: string | null;
};

type Sprint = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
};

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: "#a1a1aa",
  TODO: "#3b82f6",
  IN_PROGRESS: "#f59e0b",
  IN_REVIEW: "#8b5cf6",
  DONE: "#22c55e",
};

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 56;
const LABEL_WIDTH = 260;

export function GanttChart({
  tasks,
  sprints,
}: {
  tasks: Task[];
  sprints: Sprint[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [daysPerCell, setDaysPerCell] = useState(1);
  const [offsetWeeks, setOffsetWeeks] = useState(0);

  const cellWidth = daysPerCell === 1 ? 32 : daysPerCell === 7 ? 80 : 18;

  const { timelineStart, timelineEnd, days, weeks, months } = useMemo(() => {
    const now = new Date();
    const baseStart = startOfWeek(addDays(now, offsetWeeks * 7 - 28), { weekStartsOn: 1 });
    const baseEnd = endOfWeek(addDays(now, offsetWeeks * 7 + 56), { weekStartsOn: 1 });

    const allDates = [baseStart, baseEnd];
    tasks.forEach((t) => {
      if (t.dueDate) allDates.push(new Date(t.dueDate));
      allDates.push(new Date(t.createdAt));
    });
    sprints.forEach((s) => {
      allDates.push(new Date(s.startDate));
      allDates.push(new Date(s.endDate));
    });

    const minDate = startOfWeek(
      new Date(Math.min(...allDates.map((d) => d.getTime())) - 7 * 86400000),
      { weekStartsOn: 1 }
    );
    const maxDate = endOfWeek(
      new Date(Math.max(...allDates.map((d) => d.getTime())) + 7 * 86400000),
      { weekStartsOn: 1 }
    );

    const totalDays = differenceInDays(maxDate, minDate) + 1;
    const dayList = Array.from({ length: totalDays }, (_, i) => addDays(minDate, i));

    const weekMap = new Map<string, Date[]>();
    dayList.forEach((d) => {
      const ws = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
      if (!weekMap.has(ws)) weekMap.set(ws, []);
      weekMap.get(ws)!.push(d);
    });

    const monthMap = new Map<string, { label: string; days: number }>();
    dayList.forEach((d) => {
      const key = format(d, "yyyy-MM");
      if (!monthMap.has(key)) {
        monthMap.set(key, { label: format(d, "MMM yyyy"), days: 0 });
      }
      monthMap.get(key)!.days++;
    });

    return {
      timelineStart: minDate,
      timelineEnd: maxDate,
      days: dayList,
      weeks: Array.from(weekMap.entries()).map(([key, days]) => ({ key, days })),
      months: Array.from(monthMap.entries()).map(([key, val]) => ({ key, ...val })),
    };
  }, [tasks, sprints, offsetWeeks]);

  function dayToX(date: Date): number {
    const diff = differenceInDays(date, timelineStart);
    if (daysPerCell === 7) {
      return Math.floor(diff / 7) * cellWidth;
    }
    return diff * cellWidth;
  }

  const totalWidth =
    daysPerCell === 7
      ? weeks.length * cellWidth
      : days.length * cellWidth;

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const statusOrder = ["IN_PROGRESS", "IN_REVIEW", "TODO", "BACKLOG", "DONE"];
      const sa = statusOrder.indexOf(a.status);
      const sb = statusOrder.indexOf(b.status);
      if (sa !== sb) return sa - sb;
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return da - db;
    });
  }, [tasks]);

  const totalHeight = HEADER_HEIGHT + sortedTasks.length * ROW_HEIGHT + 8;

  function scrollToToday() {
    if (!scrollRef.current) return;
    const todayX = dayToX(new Date());
    scrollRef.current.scrollLeft = todayX - scrollRef.current.clientWidth / 2;
    setOffsetWeeks(0);
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden bg-white dark:bg-zinc-800/50">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setOffsetWeeks((w) => w - 4)}
            className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={scrollToToday}
            className="px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setOffsetWeeks((w) => w + 4)}
            className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1 bg-zinc-200/60 dark:bg-zinc-700 rounded-lg p-0.5">
          {([
            { label: "Day", value: 1 },
            { label: "Week", value: 7 },
          ] as const).map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setDaysPerCell(value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                daysPerCell === value
                  ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex" style={{ minHeight: Math.min(totalHeight + 16, 600) }}>
        {/* Left labels */}
        <div
          className="flex-shrink-0 border-r border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80"
          style={{ width: LABEL_WIDTH }}
        >
          <div
            className="border-b border-zinc-100 dark:border-zinc-700 px-3 flex items-end"
            style={{ height: HEADER_HEIGHT }}
          >
            <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide pb-2">
              Task
            </span>
          </div>
          {sortedTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 px-3 border-b border-zinc-50 dark:border-zinc-700/50 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors"
              style={{ height: ROW_HEIGHT }}
            >
              <div
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: STATUS_COLORS[task.status] ?? "#a1a1aa" }}
              />
              <Link
                href={`/tasks/${task.id}`}
                className="text-xs text-zinc-800 dark:text-zinc-200 truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex-1"
              >
                {task.title}
              </Link>
              {task.assignee && (
                <span className="text-[10px] text-zinc-400 flex-shrink-0 truncate max-w-[60px]">
                  {task.assignee.name.split(" ")[0]}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden" ref={scrollRef}>
          <svg width={totalWidth} height={totalHeight} className="block">
            {/* Month headers */}
            {daysPerCell === 1 && (() => {
              let x = 0;
              return months.map((m) => {
                const w = m.days * cellWidth;
                const el = (
                  <g key={m.key}>
                    <rect x={x} y={0} width={w} height={24} className="fill-zinc-50 dark:fill-zinc-800" />
                    <text
                      x={x + w / 2}
                      y={16}
                      textAnchor="middle"
                      className="fill-zinc-500 dark:fill-zinc-400"
                      fontSize={10}
                      fontWeight={600}
                    >
                      {m.label}
                    </text>
                    <line x1={x} y1={0} x2={x} y2={24} className="stroke-zinc-200 dark:stroke-zinc-600" strokeWidth={1} />
                  </g>
                );
                x += w;
                return el;
              });
            })()}

            {/* Day/week columns */}
            {daysPerCell === 1
              ? days.map((d, i) => {
                  const x = i * cellWidth;
                  const weekend = isWeekend(d);
                  const isToday =
                    format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                  const isFirstOfMonth = d.getDate() === 1;
                  return (
                    <g key={i}>
                      {weekend && (
                        <rect
                          x={x}
                          y={HEADER_HEIGHT}
                          width={cellWidth}
                          height={totalHeight - HEADER_HEIGHT}
                          className="fill-zinc-50/80 dark:fill-zinc-900/40"
                        />
                      )}
                      {isToday && (
                        <rect
                          x={x}
                          y={24}
                          width={cellWidth}
                          height={totalHeight - 24}
                          className="fill-blue-50/60 dark:fill-blue-500/10"
                        />
                      )}
                      <text
                        x={x + cellWidth / 2}
                        y={44}
                        textAnchor="middle"
                        className={`${isToday ? "fill-blue-600 dark:fill-blue-400" : "fill-zinc-400 dark:fill-zinc-500"}`}
                        fontSize={9}
                        fontWeight={isToday ? 700 : 400}
                      >
                        {format(d, "d")}
                      </text>
                      {(isFirstOfMonth || i === 0) && (
                        <line
                          x1={x}
                          y1={HEADER_HEIGHT}
                          x2={x}
                          y2={totalHeight}
                          className="stroke-zinc-200 dark:stroke-zinc-600"
                          strokeWidth={1}
                        />
                      )}
                    </g>
                  );
                })
              : weeks.map((w, i) => {
                  const x = i * cellWidth;
                  const weekStart = new Date(w.key);
                  const isThisWeek =
                    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd") === w.key;
                  const showMonth = i === 0 || !isSameMonth(weekStart, new Date(weeks[i - 1].key));
                  return (
                    <g key={w.key}>
                      {isThisWeek && (
                        <rect
                          x={x}
                          y={0}
                          width={cellWidth}
                          height={totalHeight}
                          className="fill-blue-50/60 dark:fill-blue-500/10"
                        />
                      )}
                      <text
                        x={x + cellWidth / 2}
                        y={16}
                        textAnchor="middle"
                        className="fill-zinc-400 dark:fill-zinc-500"
                        fontSize={9}
                        fontWeight={500}
                      >
                        {showMonth ? format(weekStart, "MMM") : ""}
                      </text>
                      <text
                        x={x + cellWidth / 2}
                        y={44}
                        textAnchor="middle"
                        className={`${isThisWeek ? "fill-blue-600 dark:fill-blue-400" : "fill-zinc-400 dark:fill-zinc-500"}`}
                        fontSize={9}
                        fontWeight={isThisWeek ? 700 : 400}
                      >
                        {format(weekStart, "d")}
                      </text>
                      <line
                        x1={x}
                        y1={HEADER_HEIGHT}
                        x2={x}
                        y2={totalHeight}
                        className="stroke-zinc-100 dark:stroke-zinc-700"
                        strokeWidth={1}
                      />
                    </g>
                  );
                })}

            {/* Header bottom line */}
            <line
              x1={0}
              y1={HEADER_HEIGHT}
              x2={totalWidth}
              y2={HEADER_HEIGHT}
              className="stroke-zinc-200 dark:stroke-zinc-600"
              strokeWidth={1}
            />

            {/* Sprint backgrounds */}
            {sprints.map((sprint) => {
              const sx = dayToX(new Date(sprint.startDate));
              const ex = dayToX(new Date(sprint.endDate));
              const w = Math.max(ex - sx, cellWidth);
              return (
                <g key={sprint.id}>
                  <rect
                    x={sx}
                    y={HEADER_HEIGHT}
                    width={w}
                    height={totalHeight - HEADER_HEIGHT}
                    rx={0}
                    className={
                      sprint.status === "ACTIVE"
                        ? "fill-violet-50/40 dark:fill-violet-500/5"
                        : "fill-zinc-50/30 dark:fill-zinc-500/5"
                    }
                  />
                  <line
                    x1={sx}
                    y1={HEADER_HEIGHT}
                    x2={sx}
                    y2={totalHeight}
                    className="stroke-violet-300/50 dark:stroke-violet-500/30"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                  <line
                    x1={sx + w}
                    y1={HEADER_HEIGHT}
                    x2={sx + w}
                    y2={totalHeight}
                    className="stroke-violet-300/50 dark:stroke-violet-500/30"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                </g>
              );
            })}

            {/* Today line */}
            {(() => {
              const todayX = dayToX(new Date());
              if (todayX >= 0 && todayX <= totalWidth) {
                return (
                  <line
                    x1={todayX}
                    y1={24}
                    x2={todayX}
                    y2={totalHeight}
                    className="stroke-red-400 dark:stroke-red-500"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                  />
                );
              }
              return null;
            })()}

            {/* Task bars */}
            {sortedTasks.map((task, i) => {
              const y = HEADER_HEIGHT + i * ROW_HEIGHT;
              const barHeight = 20;
              const barY = y + (ROW_HEIGHT - barHeight) / 2;

              const created = new Date(task.createdAt);
              const due = task.dueDate ? new Date(task.dueDate) : null;

              const startX = dayToX(created);
              const endX = due ? dayToX(due) : startX + Math.max(cellWidth * 3, 40);
              const barWidth = Math.max(endX - startX, cellWidth);

              const color = STATUS_COLORS[task.status] ?? "#a1a1aa";
              const isDone = task.status === "DONE";

              return (
                <g key={task.id}>
                  {/* Row separator */}
                  <line
                    x1={0}
                    y1={y + ROW_HEIGHT}
                    x2={totalWidth}
                    y2={y + ROW_HEIGHT}
                    className="stroke-zinc-50 dark:stroke-zinc-700/50"
                    strokeWidth={1}
                  />

                  {/* Bar */}
                  <Link href={`/tasks/${task.id}`}>
                    <rect
                      x={startX}
                      y={barY}
                      width={barWidth}
                      height={barHeight}
                      rx={4}
                      fill={color}
                      opacity={isDone ? 0.4 : 0.85}
                      className="cursor-pointer hover:opacity-100 transition-opacity"
                    />
                    {/* Progress fill for done tasks */}
                    {isDone && (
                      <rect
                        x={startX}
                        y={barY}
                        width={barWidth}
                        height={barHeight}
                        rx={4}
                        fill={color}
                        opacity={0.3}
                        style={{
                          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px)`,
                        }}
                      />
                    )}

                    {/* Bar text */}
                    {barWidth > 60 && (
                      <text
                        x={startX + 8}
                        y={barY + barHeight / 2 + 3.5}
                        fontSize={10}
                        fontWeight={500}
                        fill="white"
                        className="pointer-events-none"
                      >
                        {task.title.length > barWidth / 7
                          ? task.title.slice(0, Math.floor(barWidth / 7)) + "..."
                          : task.title}
                      </text>
                    )}
                  </Link>

                  {/* Due date marker */}
                  {due && (
                    <circle
                      cx={dayToX(due)}
                      cy={barY + barHeight / 2}
                      r={3}
                      fill="white"
                      stroke={color}
                      strokeWidth={1.5}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-zinc-100 dark:border-zinc-700 text-[10px] text-zinc-400">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1">
            <span
              className="h-2.5 w-5 rounded-sm inline-block"
              style={{ backgroundColor: color, opacity: 0.85 }}
            />
            {status.replace("_", " ")}
          </span>
        ))}
        <span className="flex items-center gap-1 ml-2">
          <span className="h-3 w-px bg-red-400 inline-block" />
          Today
        </span>
      </div>
    </div>
  );
}
