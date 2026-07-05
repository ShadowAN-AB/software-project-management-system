"use client";

import { useState } from "react";
import type { BurndownPoint } from "@/services/burndown-actions";

const CHART_W = 700;
const CHART_H = 300;
const PAD = { top: 20, right: 20, bottom: 40, left: 45 };
const INNER_W = CHART_W - PAD.left - PAD.right;
const INNER_H = CHART_H - PAD.top - PAD.bottom;

export function BurndownChart({ data }: { data: BurndownPoint[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-zinc-400">
        No data for burndown chart
      </div>
    );
  }

  const maxTasks = Math.max(...data.map((d) => d.ideal), ...data.filter((d) => d.actual !== null).map((d) => d.actual!));
  const yMax = Math.ceil(maxTasks);

  function x(i: number) {
    return PAD.left + (i / (data.length - 1)) * INNER_W;
  }

  function y(val: number) {
    return PAD.top + INNER_H - (val / yMax) * INNER_H;
  }

  // Build path strings
  const idealPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.ideal)}`).join(" ");
  const actualPoints = data.filter((d) => d.actual !== null);
  const actualPath = actualPoints
    .map((d, i) => {
      const idx = data.indexOf(d);
      return `${i === 0 ? "M" : "L"} ${x(idx)} ${y(d.actual!)}`;
    })
    .join(" ");

  // Y-axis ticks
  const yTicks = [];
  const tickStep = Math.max(1, Math.ceil(yMax / 5));
  for (let v = 0; v <= yMax; v += tickStep) {
    yTicks.push(v);
  }

  // X-axis labels (show ~6 dates max)
  const labelStep = Math.max(1, Math.floor(data.length / 6));
  const xLabels = data.filter((_, i) => i % labelStep === 0 || i === data.length - 1);

  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full h-auto"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* Grid lines */}
        {yTicks.map((v) => (
          <line
            key={v}
            x1={PAD.left}
            y1={y(v)}
            x2={CHART_W - PAD.right}
            y2={y(v)}
            className="stroke-zinc-200 dark:stroke-zinc-700"
            strokeWidth={0.5}
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((v) => (
          <text
            key={v}
            x={PAD.left - 8}
            y={y(v) + 4}
            textAnchor="end"
            className="fill-zinc-400 dark:fill-zinc-500 text-[11px]"
          >
            {v}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((d) => {
          const idx = data.indexOf(d);
          const label = d.date.slice(5); // MM-DD
          return (
            <text
              key={d.date}
              x={x(idx)}
              y={CHART_H - 8}
              textAnchor="middle"
              className="fill-zinc-400 dark:fill-zinc-500 text-[10px]"
            >
              {label}
            </text>
          );
        })}

        {/* Ideal line */}
        <path
          d={idealPath}
          fill="none"
          className="stroke-zinc-300 dark:stroke-zinc-600"
          strokeWidth={2}
          strokeDasharray="6 4"
        />

        {/* Actual line */}
        {actualPath && (
          <path
            d={actualPath}
            fill="none"
            className="stroke-blue-500"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Actual dots */}
        {actualPoints.map((d) => {
          const idx = data.indexOf(d);
          return (
            <circle
              key={d.date}
              cx={x(idx)}
              cy={y(d.actual!)}
              r={3}
              className="fill-blue-500"
            />
          );
        })}

        {/* Hover targets */}
        {data.map((d, i) => (
          <rect
            key={i}
            x={x(i) - INNER_W / data.length / 2}
            y={PAD.top}
            width={INNER_W / data.length}
            height={INNER_H}
            fill="transparent"
            onMouseEnter={() => setHoveredIdx(i)}
          />
        ))}

        {/* Hover crosshair */}
        {hoveredIdx !== null && (
          <line
            x1={x(hoveredIdx)}
            y1={PAD.top}
            x2={x(hoveredIdx)}
            y2={PAD.top + INNER_H}
            className="stroke-zinc-400 dark:stroke-zinc-500"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
      </svg>

      {/* Tooltip */}
      {hovered && hoveredIdx !== null && (
        <div
          className="absolute bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none z-10"
          style={{
            left: `${(x(hoveredIdx) / CHART_W) * 100}%`,
            top: `${(y(hovered.actual ?? hovered.ideal) / CHART_H) * 100 - 12}%`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="font-medium text-zinc-700 dark:text-zinc-200">{hovered.date}</p>
          <p className="text-zinc-400">
            Ideal: <span className="text-zinc-600 dark:text-zinc-300">{hovered.ideal}</span>
          </p>
          {hovered.actual !== null && (
            <p className="text-zinc-400">
              Remaining: <span className="text-blue-600 dark:text-blue-400 font-medium">{hovered.actual}</span>
            </p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 border-t-2 border-dashed border-zinc-300 dark:border-zinc-600" />
          <span className="text-xs text-zinc-400">Ideal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-blue-500 rounded" />
          <span className="text-xs text-zinc-400">Actual</span>
        </div>
      </div>
    </div>
  );
}
