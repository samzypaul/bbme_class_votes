"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createPosition, movePosition, togglePositionActive, updatePosition } from "@/app/actions/admin";
import type { Position } from "@/types/database";

export function PositionManager({
  electionId,
  positions,
}: {
  electionId: string;
  positions: Position[];
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [, startTransition] = useTransition();

  function move(id: string, direction: "up" | "down") {
    startTransition(async () => {
      await movePosition(electionId, id, direction);
      router.refresh();
    });
  }

  function toggle(id: string, isActive: boolean) {
    startTransition(async () => {
      const result = await togglePositionActive(id, isActive);
      if (result.ok) {
        toast.success(isActive ? "Position enabled." : "Position disabled.");
        router.refresh();
      }
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
          Add Position
        </Button>
      </div>

      {positions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No positions yet. Add the first one above.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {positions.map((position, index) => (
            <Card key={position.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-0.5 pt-0.5">
                    <button
                      className="focus-ring rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() => move(position.id, "up")}
                      aria-label={`Move ${position.name} up`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      className="focus-ring rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={index === positions.length - 1}
                      onClick={() => move(position.id, "down")}
                      aria-label={`Move ${position.name} down`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-foreground">{position.name}</p>
                      <Badge variant={position.is_active ? "success" : "muted"}>
                        {position.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    {position.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{position.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(position);
                      setDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant={position.is_active ? "outline" : "secondary"}
                    size="sm"
                    onClick={() => toggle(position.id, !position.is_active)}
                  >
                    {position.is_active ? "Disable" : "Enable"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PositionDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        electionId={electionId}
        position={editing}
        nextOrder={positions.length}
      />
    </div>
  );
}

function PositionDialog({
  open,
  onOpenChange,
  electionId,
  position,
  nextOrder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  electionId: string;
  position: Position | null;
  nextOrder: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    const input = {
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || "",
      display_order: Number(formData.get("display_order")),
      is_active: position?.is_active ?? true,
    };

    startTransition(async () => {
      const result = position
        ? await updatePosition(position.id, input)
        : await createPosition(electionId, input);

      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }

      toast.success(position ? "Position updated." : "Position added.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{position ? "Edit Position" : "Add Position"}</DialogTitle>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Position Name</Label>
            <Input id="name" name="name" required defaultValue={position?.name} placeholder="e.g. President" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" defaultValue={position?.description ?? ""} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="display_order">Display Order</Label>
            <Input
              id="display_order"
              name="display_order"
              type="number"
              min={0}
              defaultValue={position?.display_order ?? nextOrder}
            />
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              {position ? "Save Changes" : "Add Position"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
