import Link from "next/link";
import { ArrowRight, BarChart3, CheckSquare, Search } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/election/site-header";
import { ElectionStatusBadge } from "@/components/election/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentElection } from "@/lib/voting/queries";
import { formatDateTime } from "@/lib/utils";

export default async function Home() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const election = await getCurrentElection(supabase);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader profile={profile} />

      <main className="flex-1">
        <section className="border-b border-border bg-gradient-to-b from-accent/60 to-background">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
            <p className="text-sm font-bold uppercase tracking-widest text-primary">
              MUBAS Biomedical Engineering &middot; Class of 2025
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-foreground sm:text-5xl">
              Welfare Board Election
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              Choose the leaders who will represent and serve our class. No account needed --
              just open the election and vote.
            </p>

            {election && (
              <div className="mt-6 flex justify-center">
                <ElectionStatusBadge status={election.status} />
              </div>
            )}
            {election && election.status === "draft" && (
              <p className="mt-2 text-sm text-muted-foreground">
                Voting opens {formatDateTime(election.start_at)}
              </p>
            )}

            <div className="mt-8 flex justify-center">
              <Button size="lg" asChild>
                <Link href="/vote">
                  Vote Now
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-foreground">How It Works</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <HowItWorksStep
              icon={<Search className="h-5 w-5" />}
              step="1"
              title="Open the election"
              description="No sign-up required -- go straight to the ballot for every open position."
            />
            <HowItWorksStep
              icon={<CheckSquare className="h-5 w-5" />}
              step="2"
              title="Search and vote"
              description="Type a candidate's name, pick them for each position, then review your choices."
            />
            <HowItWorksStep
              icon={<BarChart3 className="h-5 w-5" />}
              step="3"
              title="View official results"
              description="See winners, charts, and AI summaries once voting closes."
            />
          </div>
        </section>

        <section className="border-t border-border bg-secondary/40">
          <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6">
            <p className="text-sm font-semibold text-primary">One member, one vote per position</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Results are calculated directly from recorded votes. Individual voting choices are
              never shown publicly -- only aggregate results after voting closes.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function HowItWorksStep({
  icon,
  step,
  title,
  description,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-primary">
          {icon}
        </div>
        <p className="text-xs font-bold text-muted-foreground">STEP {step}</p>
        <p className="font-bold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
