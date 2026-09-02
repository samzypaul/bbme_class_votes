import { Badge } from "@/components/ui/badge";
import type { ElectionStatus } from "@/types/database";

export function ElectionStatusBadge({ status }: { status: ElectionStatus }) {
  if (status === "open") return <Badge variant="success">Voting Open</Badge>;
  if (status === "closed") return <Badge variant="muted">Voting Closed</Badge>;
  return <Badge variant="warning">Draft &middot; Not Yet Open</Badge>;
}
