// Hand-written types mirroring supabase/migrations/0001_init.sql.
// If the schema changes, update this file to match.
//
// Shape must satisfy @supabase/postgrest-js's GenericSchema constraint
// exactly (Tables/Views/Functions, each Table carrying Relationships) or
// TypeScript silently collapses every table's Row/Insert/Update to `never`.

export type ElectionStatus = "draft" | "open" | "closed";
export type UserRole = "member" | "admin";

export type Profile = {
  id: string;
  email: string | null;
  nickname: string | null;
  role: UserRole;
  created_at: string;
};

export type ClassMember = {
  id: string;
  full_name: string;
  department: string;
  graduation_year: number;
  is_active: boolean;
  created_at: string;
};

export type Election = {
  id: string;
  name: string;
  description: string | null;
  start_at: string;
  end_at: string;
  status: ElectionStatus;
  created_at: string;
};

export type Position = {
  id: string;
  election_id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

export type Vote = {
  id: string;
  election_id: string;
  position_id: string;
  voter_id: string;
  candidate_id: string;
  created_at: string;
};

export type AiSummary = {
  id: string;
  election_id: string;
  position_id: string;
  summary: string;
  winner_name: string | null;
  winner_votes: number | null;
  winner_percentage: number | null;
  is_tie: boolean;
  generated_at: string;
};

export type AuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type PositionResultRow = {
  candidate_id: string;
  candidate_name: string;
  vote_count: number;
};

type NoRelationships = { Relationships: [] };

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
      } & NoRelationships;
      class_members: {
        Row: ClassMember;
        Insert: Partial<ClassMember> & { full_name: string };
        Update: Partial<ClassMember>;
      } & NoRelationships;
      elections: {
        Row: Election;
        Insert: Partial<Election> & { name: string; start_at: string; end_at: string };
        Update: Partial<Election>;
      } & NoRelationships;
      positions: {
        Row: Position;
        Insert: Partial<Position> & { election_id: string; name: string };
        Update: Partial<Position>;
      } & NoRelationships;
      votes: {
        Row: Vote;
        Insert: Partial<Vote> & {
          election_id: string;
          position_id: string;
          voter_id: string;
          candidate_id: string;
        };
        Update: Partial<Vote>;
      } & NoRelationships;
      ai_summaries: {
        Row: AiSummary;
        Insert: Partial<AiSummary> & { election_id: string; position_id: string; summary: string };
        Update: Partial<AiSummary>;
      } & NoRelationships;
      audit_logs: {
        Row: AuditLog;
        Insert: Partial<AuditLog> & { action: string; entity_type: string };
        Update: Partial<AuditLog>;
      } & NoRelationships;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      get_position_results: {
        Args: { p_position_id: string };
        Returns: PositionResultRow[];
      };
    };
  };
};
