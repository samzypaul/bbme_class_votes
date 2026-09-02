"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";
import type { Election } from "@/types/database";

export function ElectionSwitcher({
  elections,
  currentId,
}: {
  elections: Election[];
  currentId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  if (elections.length <= 1) return null;

  return (
    <Select value={currentId} onValueChange={(id) => router.push(`${pathname}?election=${id}`)}>
      <SelectTrigger className="w-full sm:w-96">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {elections.map((election) => (
          <SelectItem key={election.id} value={election.id}>
            {election.name} &middot; {formatDateTime(election.start_at)} &middot; {election.status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
