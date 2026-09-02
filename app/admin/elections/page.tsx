import { ElectionManager } from "@/components/admin/election-manager";
import { createClient } from "@/lib/supabase/server";

export default async function AdminElectionsPage() {
  const supabase = await createClient();
  const { data: elections } = await supabase
    .from("elections")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Elections</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage the voting period for the class election.
        </p>
      </div>
      <ElectionManager elections={elections ?? []} />
    </div>
  );
}
