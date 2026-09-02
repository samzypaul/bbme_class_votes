import { MemberManager } from "@/components/admin/member-manager";
import { createClient } from "@/lib/supabase/server";

export default async function AdminMembersPage() {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("class_members")
    .select("*")
    .order("full_name", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Class Members</h1>
        <p className="text-sm text-muted-foreground">
          Manage the roster of candidates who can be voted for.
        </p>
      </div>
      <MemberManager members={members ?? []} />
    </div>
  );
}
