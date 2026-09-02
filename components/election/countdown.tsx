"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function getRemaining(targetIso: string) {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function Countdown({
  targetIso,
  label = "Voting closes in",
  onComplete,
}: {
  targetIso: string;
  label?: string;
  onComplete?: () => void;
}) {
  const [remaining, setRemaining] = useState<ReturnType<typeof getRemaining>>(null);

  useEffect(() => {
    setRemaining(getRemaining(targetIso));
    const interval = setInterval(() => {
      const next = getRemaining(targetIso);
      setRemaining(next);
      if (!next) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [targetIso, onComplete]);

  if (!remaining) return null;

  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-6 py-4 shadow-sm">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        {label}
      </span>
      <div className="flex items-center gap-2 font-mono text-2xl font-bold text-primary sm:text-3xl">
        <TimeUnit value={remaining.days} unit="d" />
        <span className="text-muted-foreground">:</span>
        <TimeUnit value={remaining.hours} unit="h" />
        <span className="text-muted-foreground">:</span>
        <TimeUnit value={remaining.minutes} unit="m" />
        <span className="text-muted-foreground">:</span>
        <TimeUnit value={remaining.seconds} unit="s" />
      </div>
    </div>
  );
}

function TimeUnit({ value, unit }: { value: number; unit: string }) {
  return (
    <span className="flex items-baseline gap-0.5">
      {pad(value)}
      <span className="text-xs font-semibold text-muted-foreground">{unit}</span>
    </span>
  );
}
