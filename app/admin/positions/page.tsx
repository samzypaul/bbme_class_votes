import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PositionManager } from "@/components/admin/position-manager";
import { createClient } from "@/lib/supabase/server";
import { getCurrentElection } from "@/lib/voting/queries";

export default async function AdminPositionsPage() {
  const supabase = await createClient();
  const election = await getCurrentElection(supabase);

  if (!election) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <p className="font-bold text-foreground">Create an election first</p>
          <p className="text-sm text-muted-foreground">
            Positions belong to an election. Create one before adding positions.
          </p>
          <Button asChild size="sm">
            <Link href="/admin/elections">Go to Elections</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { data: positions } = await supabase
    .from("positions")
    .select("*")
    .eq("election_id", election.id)
    .order("display_order", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Positions</h1>
        <p className="text-sm text-muted-foreground">{election.name}</p>
      </div>
      <PositionManager electionId={election.id} positions={positions ?? []} />
    </div>
  );
}
