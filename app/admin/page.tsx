import Link from "next/link";
import { BarChart3, ListOrdered, Users, Vote as VoteIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ElectionStatusBadge } from "@/components/election/status-badge";
import { createClient } from "@/lib/supabase/server";
import { getCurrentElection } from "@/lib/voting/queries";
import { percentage } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const election = await getCurrentElection(supabase);

  const [{ count: totalMembers }, { count: totalPositions }] = await Promise.all([
    supabase.from("class_members").select("*", { count: "exact", head: true }).eq("is_active", true),
    election
      ? supabase
          .from("positions")
          .select("*", { count: "exact", head: true })
          .eq("election_id", election.id)
          .eq("is_active", true)
      : Promise.resolve({ count: 0 }),
  ]);

  let votesCast = 0;
  let distinctVoters = 0;

  if (election) {
    const { data: votes, count } = await supabase
      .from("votes")
      .select("voter_id", { count: "exact" })
      .eq("election_id", election.id);
    votesCast = count ?? 0;
    distinctVoters = new Set((votes ?? []).map((v) => v.voter_id)).size;
  }

  // Voting has no registration step, so there's no "registered voter" count
  // to divide by -- the class roster (class_members) doubles as the
  // electorate size for this participation estimate.
  const participation = totalMembers ? percentage(distinctVoters, totalMembers) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-foreground">Dashboard</h1>
        {election && <ElectionStatusBadge status={election.status} />}
      </div>

      {!election && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
            <p className="text-sm font-medium text-amber-900">
              No election has been created yet. Create one to get started.
            </p>
            <Button asChild size="sm">
              <Link href="/admin/elections">Create Election</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Total Members" value={totalMembers ?? 0} />
        <StatCard icon={<VoteIcon className="h-5 w-5" />} label="Votes Cast" value={votesCast} />
        <StatCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Participation"
          value={`${participation}%`}
        />
        <StatCard
          icon={<ListOrdered className="h-5 w-5" />}
          label="Positions"
          value={totalPositions ?? 0}
        />
      </div>

      {election && (
        <Card>
          <CardHeader>
            <CardTitle>{election.name}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-semibold text-foreground capitalize">{election.status}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Starts</p>
              <p className="font-semibold text-foreground">
                {new Date(election.start_at).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Ends</p>
              <p className="font-semibold text-foreground">
                {new Date(election.end_at).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <QuickLink href="/admin/positions" title="Manage Positions" description="Add, edit, reorder, or disable positions." />
        <QuickLink href="/admin/members" title="Class Members" description="Manage the candidate roster and import via CSV." />
        <QuickLink href="/admin/results" title="Results & AI Summaries" description="View detailed results and generate AI summaries." />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-black text-foreground">{value}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="focus-ring block">
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="pt-6">
          <p className="font-bold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
