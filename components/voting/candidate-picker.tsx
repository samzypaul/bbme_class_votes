"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchCandidates } from "@/lib/voting/matching";
import type { CandidateOption } from "@/types/database";

export function CandidatePicker({
  roster,
  value,
  onChange,
  placeholder = "Start typing candidate name...",
}: {
  roster: CandidateOption[];
  value: CandidateOption | null;
  onChange: (candidate: CandidateOption | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => searchCandidates(query, roster, 8), [query, roster]);

  if (value) {
    return (
      <div className="flex h-11 items-center justify-between rounded-lg border border-primary/40 bg-accent px-3.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-accent-foreground">
          <Check className="h-4 w-4" />
          {value.full_name}
        </span>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
          className="focus-ring rounded-full p-1 text-accent-foreground/70 hover:bg-white/60"
          aria-label={`Change selection, currently ${value.full_name}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="pl-9 pr-9"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      {open && (
        <div className="absolute z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg">
          {matches.length === 0 ? (
            <p className="px-3.5 py-3 text-sm text-muted-foreground">
              {roster.length === 0
                ? "No nominees have been added for this position yet."
                : "No matching nominee found. Check the spelling and try again."}
            </p>
          ) : (
            matches.map((member) => (
              <button
                type="button"
                key={member.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(member);
                  setQuery("");
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center px-3.5 py-2.5 text-left text-sm text-foreground hover:bg-secondary focus:bg-secondary"
                )}
              >
                {member.full_name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
