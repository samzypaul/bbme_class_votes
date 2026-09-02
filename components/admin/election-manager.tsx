"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ElectionStatusBadge } from "@/components/election/status-badge";
import { formatDateTime } from "@/lib/utils";
import { createElection, deleteElection, updateElection } from "@/app/actions/admin";
import type { Election, ElectionStatus } from "@/types/database";

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ElectionManager({ elections }: { elections: Election[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Election | null>(null);
  const [, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function remove(election: Election) {
    if (
      !confirm(
        `Permanently delete "${election.name}"? This deletes its positions, candidates, every vote cast, AI summaries, and result history. This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingId(election.id);
    startTransition(async () => {
      const result = await deleteElection(election.id);
      setDeletingId(null);
      if (!result.ok) {
        toast.error(result.error ?? "Could not delete the election.");
        return;
      }
      toast.success("Election deleted.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus />
          New Election
        </Button>
      </div>

      {elections.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No elections yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {elections.map((election) => (
            <Card key={election.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-foreground">{election.name}</p>
                    <ElectionStatusBadge status={election.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDateTime(election.start_at)} &rarr; {formatDateTime(election.end_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(election);
                      setDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    loading={deletingId === election.id}
                    onClick={() => remove(election)}
                  >
                    <Trash2 />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ElectionDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        election={editing}
      />
    </div>
  );
}

function ElectionDialog({
  open,
  onOpenChange,
  election,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  election: Election | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ElectionStatus>(election?.status ?? "draft");

  function handleSubmit(formData: FormData) {
    setError(null);
    const input = {
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || "",
      start_at: formData.get("start_at") as string,
      end_at: formData.get("end_at") as string,
      status,
    };

    startTransition(async () => {
      const result = election
        ? await updateElection(election.id, input)
        : await createElection(input);

      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }

      toast.success(election ? "Election updated." : "Election created.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{election ? "Edit Election" : "New Election"}</DialogTitle>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Election Name</Label>
            <Input id="name" name="name" required defaultValue={election?.name} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" defaultValue={election?.description ?? ""} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="start_at">Voting Start</Label>
              <Input
                id="start_at"
                name="start_at"
                type="datetime-local"
                required
                defaultValue={election ? toLocalInputValue(election.start_at) : undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_at">Voting End</Label>
              <Input
                id="end_at"
                name="end_at"
                type="datetime-local"
                required
                defaultValue={election ? toLocalInputValue(election.end_at) : undefined}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ElectionStatus)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            {status === "closed" && (
              <p className="text-xs text-amber-700">
                Closing the election will make results visible to all members.
              </p>
            )}
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              {election ? "Save Changes" : "Create Election"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
