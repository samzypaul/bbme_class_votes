"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createClassMember,
  deleteClassMember,
  importClassMembersCsv,
  toggleClassMemberActive,
  updateClassMember,
} from "@/app/actions/admin";
import type { ClassMember } from "@/types/database";

export function MemberManager({ members }: { members: ClassMember[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClassMember | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.full_name.toLowerCase().includes(q));
  }, [query, members]);

  function toggle(id: string, isActive: boolean) {
    startTransition(async () => {
      await toggleClassMemberActive(id, isActive);
      router.refresh();
    });
  }

  function remove(member: ClassMember) {
    if (!confirm(`Remove ${member.full_name}? If they have votes, disable them instead.`)) return;
    startTransition(async () => {
      const result = await deleteClassMember(member.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Class member removed.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search class members..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload />
            Import CSV
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus />
            Add Member
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} of {members.length} class members
      </p>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No class members found.</p>
            ) : (
              filtered.map((member) => (
                <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{member.full_name}</p>
                      <Badge variant={member.is_active ? "success" : "muted"}>
                        {member.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {member.department} &middot; Class of {member.graduation_year}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing(member);
                        setDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant={member.is_active ? "outline" : "secondary"}
                      size="sm"
                      onClick={() => toggle(member.id, !member.is_active)}
                    >
                      {member.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => remove(member)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <MemberDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} member={editing} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function MemberDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: ClassMember | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    const input = {
      full_name: formData.get("full_name") as string,
      department: formData.get("department") as string,
      graduation_year: Number(formData.get("graduation_year")),
    };

    startTransition(async () => {
      const result = member
        ? await updateClassMember(member.id, input)
        : await createClassMember(input);

      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }

      toast.success(member ? "Class member updated." : "Class member added.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member ? "Edit Class Member" : "Add Class Member"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full Name</Label>
            <Input id="full_name" name="full_name" required defaultValue={member?.full_name} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                name="department"
                required
                defaultValue={member?.department ?? "Biomedical Engineering"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="graduation_year">Graduation Year</Label>
              <Input
                id="graduation_year"
                name="graduation_year"
                type="number"
                required
                defaultValue={member?.graduation_year ?? 2025}
              />
            </div>
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              {member ? "Save Changes" : "Add Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ inserted?: number; skipped?: number; errors?: string[] } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }
    setError(null);
    setResult(null);

    startTransition(async () => {
      const text = await file.text();
      const res = await importClassMembersCsv(text);
      if (!res.ok) {
        setError(res.error ?? "Import failed.");
        return;
      }
      setResult(res);
      toast.success(`Imported ${res.inserted} class member(s).`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Class Members</DialogTitle>
          <DialogDescription>
            CSV columns: <code>full_name,department,graduation_year</code>. Duplicate names (by
            name + graduation year) are skipped automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input ref={fileRef} type="file" accept=".csv,text/csv" />
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          {result && (
            <div className="rounded-lg bg-secondary p-3 text-sm">
              <p>
                Inserted <strong>{result.inserted}</strong>, skipped <strong>{result.skipped}</strong>{" "}
                duplicate(s).
              </p>
              {result.errors && result.errors.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-destructive">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleImport} loading={isPending}>
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
