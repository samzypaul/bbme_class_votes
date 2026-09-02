"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { PositionResultRow } from "@/types/database";

const BAR_COLOR = "#1d4ed8";
const WINNER_COLOR = "#15803d";

export function ResultsBarChart({
  data,
  totalVotes,
  winnerIds,
}: {
  data: PositionResultRow[];
  totalVotes: number;
  winnerIds: Set<string>;
}) {
  const chartData = data.map((row) => ({
    name: row.candidate_name,
    votes: Number(row.vote_count),
    percentage: totalVotes > 0 ? Math.round((Number(row.vote_count) / totalVotes) * 1000) / 10 : 0,
    isWinner: winnerIds.has(row.candidate_id),
  }));

  return (
    <div
      role="img"
      aria-label={`Bar chart of votes per candidate: ${chartData
        .map((d) => `${d.name}, ${d.votes} votes, ${d.percentage} percent`)
        .join("; ")}`}
      className="h-[max(220px,calc(2.75rem*var(--rows)))] w-full"
      style={{ "--rows": chartData.length } as React.CSSProperties}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Bar dataKey="votes" radius={[0, 6, 6, 0]} maxBarSize={28}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.isWinner ? WINNER_COLOR : BAR_COLOR} />
            ))}
            <LabelList
              dataKey="votes"
              position="right"
              content={({ x, y, width, height, index }) => {
                const row = chartData[index as number];
                if (!row) return null;
                const cx = Number(x) + Number(width) + 8;
                const cy = Number(y) + Number(height) / 2;
                return (
                  <text x={cx} y={cy} dy={4} fontSize={12} fontWeight={600} fill="var(--foreground)">
                    {row.votes} ({row.percentage}%)
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
