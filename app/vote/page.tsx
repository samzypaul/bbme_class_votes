import { AlertTriangle, CheckCircle2, Hourglass } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/election/site-header";
import { Countdown } from "@/components/election/countdown";
import { ElectionStatusBadge } from "@/components/election/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VotingForm } from "@/components/voting/voting-form";
import { getCurrentProfile } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import {
  getActivePositions,
  getCandidatesByPositions,
  getCurrentElection,
  getUserVoteMap,
} from "@/lib/voting/queries";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

export default async function VotePage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const election = await getCurrentElection(supabase);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader profile={profile} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            MUBAS Biomedical Engineering &middot; Class of 2025
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            Welfare Board Election
          </h1>
        </div>

        {!profile ? (
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6" />}
            title="We couldn't start your voting session."
            description="Please refresh the page. If this keeps happening, contact an administrator."
          />
        ) : !election ? (
          <EmptyState
            icon={<Hourglass className="h-6 w-6" />}
            title="No election has been configured yet."
            description="Please check back later. An administrator is setting up the election."
          />
        ) : election.status === "draft" ? (
          <EmptyState
            icon={<Hourglass className="h-6 w-6" />}
            title="Voting has not opened yet."
            description={`${election.name} opens on ${formatDateTime(election.start_at)}.`}
          />
        ) : election.status === "closed" ? (
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6" />}
            title="Voting has closed."
            description="View the official results below."
            action={
              <Button asChild>
                <Link href="/results">View Results</Link>
              </Button>
            }
          />
        ) : (
          <OpenElection election={election} voterId={profile.id} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

async function OpenElection({ election, voterId }: { election: NonNullable<Awaited<ReturnType<typeof getCurrentElection>>>; voterId: string }) {
  const supabase = await createClient();
  const [positions, voteMap] = await Promise.all([
    getActivePositions(supabase, election.id),
    getUserVoteMap(supabase, voterId, election.id),
  ]);

  if (positions.length === 0) {
    return (
      <EmptyState
        icon={<Hourglass className="h-6 w-6" />}
        title="No positions are open for voting yet."
        description="Please check back once an administrator has configured the ballot."
      />
    );
  }

  const unvotedPositions = positions.filter((p) => !voteMap[p.id]);
  const votedPositionNames = positions.filter((p) => voteMap[p.id]).map((p) => p.name);
  const candidatesByPosition = await getCandidatesByPositions(
    supabase,
    unvotedPositions.map((p) => p.id)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <ElectionStatusBadge status={election.status} />
        <Countdown targetIso={election.end_at} />
      </div>

      {unvotedPositions.length === 0 ? (
        <Card className="mx-auto max-w-xl border-green-200 bg-green-50">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <h2 className="text-xl font-bold text-green-900">
              Your votes have been successfully recorded.
            </h2>
            <p className="text-sm text-green-800">
              Thank you for participating in the MUBAS Biomedical Engineering Class of 2025
              Welfare Board Election. Results will be available once voting closes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <VotingForm
          election={election}
          positions={unvotedPositions}
          candidatesByPosition={candidatesByPosition}
          alreadyVotedPositionNames={votedPositionNames}
        />
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
          {icon}
        </div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}
