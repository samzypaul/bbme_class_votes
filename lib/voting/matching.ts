import { distance } from "fastest-levenshtein";
import type { ClassMember } from "@/types/database";

export interface CandidateMatch {
  candidate: ClassMember;
  score: number; // 0 = exact match, higher = further away
}

/**
 * Resolves free-typed candidate input against the pre-seeded class roster.
 *
 * Step 1: exact match (case-insensitive, trimmed).
 * Step 2: fuzzy match using edit distance for minor typos.
 *
 * Returns `{ exact }` when there is an unambiguous match, or `{ suggestions }`
 * when the input is ambiguous / only fuzzily close -- callers must require
 * the user to explicitly pick one of the suggestions rather than silently
 * guessing.
 */
export function resolveCandidate(
  input: string,
  roster: ClassMember[]
): { exact: ClassMember } | { suggestions: ClassMember[] } | { suggestions: [] } {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return { suggestions: [] };

  const exact = roster.find((m) => m.full_name.trim().toLowerCase() === normalized);
  if (exact) return { exact };

  const scored: CandidateMatch[] = roster
    .map((candidate) => ({
      candidate,
      score: distance(normalized, candidate.full_name.trim().toLowerCase()),
    }))
    .filter((m) => m.score <= Math.max(2, Math.floor(candidate_threshold(normalized))))
    .sort((a, b) => a.score - b.score);

  if (scored.length === 0) return { suggestions: [] };

  // Only surface close matches; require explicit user selection.
  const best = scored[0].score;
  const close = scored.filter((m) => m.score <= best + 1).slice(0, 5);
  return { suggestions: close.map((m) => m.candidate) };
}

function candidate_threshold(input: string) {
  // Allow proportionally more edit distance for longer names.
  return Math.min(4, Math.ceil(input.length * 0.3));
}

/** Live autocomplete suggestions as the member types, ranked by relevance. */
export function searchCandidates(query: string, roster: ClassMember[], limit = 8): ClassMember[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return roster.slice(0, limit);

  const starts: ClassMember[] = [];
  const contains: ClassMember[] = [];
  const fuzzy: CandidateMatch[] = [];

  for (const member of roster) {
    const name = member.full_name.toLowerCase();
    if (name.startsWith(normalized)) {
      starts.push(member);
    } else if (name.includes(normalized)) {
      contains.push(member);
    } else {
      const score = distance(normalized, name);
      if (score <= candidate_threshold(normalized)) {
        fuzzy.push({ candidate: member, score });
      }
    }
  }

  fuzzy.sort((a, b) => a.score - b.score);

  return [...starts, ...contains, ...fuzzy.map((f) => f.candidate)].slice(0, limit);
}
