"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CandidatePicker } from "@/components/voting/candidate-picker";
import { castVotes } from "@/app/actions/votes";
import type { CandidateOption, Election, Position } from "@/types/database";

export function VotingForm({
  election,
  positions,
  candidatesByPosition,
  alreadyVotedPositionNames,
}: {
  election: Election;
  positions: Position[];
  candidatesByPosition: Record<string, CandidateOption[]>;
  alreadyVotedPositionNames: string[];
}) {
  const router = useRouter();
  const [selections, setSelections] = useState<Record<string, CandidateOption | null>>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const allSelected = positions.every((p) => selections[p.id]);

  const reviewRows = useMemo(
    () =>
      positions.map((p) => ({
        position: p,
        candidate: selections[p.id] ?? null,
      })),
    [positions, selections]
  );

  function handleConfirm() {
    setSubmitError(null);
    startTransition(async () => {
      const result = await castVotes({
        election_id: election.id,
        selections: positions.map((p) => ({
          position_id: p.id,
          candidate_id: selections[p.id]!.id,
        })),
      });

      if (!result.ok) {
        setSubmitError(result.error ?? "Something went wrong. Please try again.");
        return;
      }

      setReviewOpen(false);
      toast.success("Your votes have been successfully recorded.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {alreadyVotedPositionNames.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            You&apos;ve already voted for: <strong>{alreadyVotedPositionNames.join(", ")}</strong>.
            Those votes are locked in and cannot be changed.
          </p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {positions.map((position) => (
          <Card key={position.id}>
            <CardHeader>
              <CardTitle className="text-base uppercase tracking-wide text-primary">
                {position.name}
              </CardTitle>
              {position.description && (
                <CardDescription>{position.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <Label className="mb-2 block">Who do you want to vote for?</Label>
              <CandidatePicker
                roster={candidatesByPosition[position.id] ?? []}
                value={selections[position.id] ?? null}
                onChange={(candidate) =>
                  setSelections((prev) => ({ ...prev, [position.id]: candidate }))
                }
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="sticky bottom-4 flex justify-center sm:justify-end">
        <Button
          size="lg"
          disabled={!allSelected}
          onClick={() => setReviewOpen(true)}
          className="w-full shadow-lg sm:w-auto"
        >
          Review My Votes
          <ArrowRight />
        </Button>
      </div>

      <Dialog open={reviewOpen} onOpenChange={(open) => !isPending && setReviewOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review your votes</DialogTitle>
            <DialogDescription>{election.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {reviewRows.map(({ position, candidate }) => (
              <div
                key={position.id}
                className="flex items-center justify-between rounded-lg bg-secondary px-4 py-3"
              >
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {position.name}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {candidate?.full_name}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>You cannot change your votes after submission.</p>
          </div>

          {submitError && (
            <p className="mt-3 text-sm font-medium text-destructive">{submitError}</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={isPending}>
              Go Back
            </Button>
            <Button onClick={handleConfirm} loading={isPending}>
              Confirm and Submit Votes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
