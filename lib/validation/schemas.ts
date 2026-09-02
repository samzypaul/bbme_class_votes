import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  nickname: z
    .string()
    .trim()
    .min(2, "Nickname must be at least 2 characters.")
    .max(40, "Nickname must be under 40 characters.")
    .regex(/^[a-zA-Z0-9 _.'-]+$/, "Nickname contains invalid characters."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password is too long."),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const electionSchema = z
  .object({
    name: z.string().trim().min(3, "Name is too short.").max(200),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    start_at: z.string().min(1, "Start date/time is required."),
    end_at: z.string().min(1, "End date/time is required."),
    status: z.enum(["draft", "open", "closed"]),
  })
  .refine((data) => new Date(data.end_at) > new Date(data.start_at), {
    message: "End date/time must be after the start date/time.",
    path: ["end_at"],
  });
export type ElectionInput = z.infer<typeof electionSchema>;

export const positionSchema = z.object({
  name: z.string().trim().min(2, "Name is too short.").max(100),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  display_order: z.coerce.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});
export type PositionInput = z.infer<typeof positionSchema>;

export const classMemberSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is too short.").max(150),
  department: z.string().trim().min(2).max(150).default("Biomedical Engineering"),
  graduation_year: z.coerce.number().int().min(1990).max(2100).default(2025),
});
export type ClassMemberInput = z.infer<typeof classMemberSchema>;

export const csvClassMemberRowSchema = z.object({
  full_name: z.string().trim().min(2).max(150),
  department: z.string().trim().min(1).max(150).default("Biomedical Engineering"),
  graduation_year: z.coerce.number().int().min(1990).max(2100).default(2025),
});
export type CsvClassMemberRow = z.infer<typeof csvClassMemberRowSchema>;

// One selection per position submitted from the voting form.
export const ballotSelectionSchema = z.object({
  position_id: z.string().uuid(),
  candidate_id: z.string().uuid(),
});

export const castVotesSchema = z.object({
  election_id: z.string().uuid(),
  selections: z.array(ballotSelectionSchema).min(1, "Select at least one candidate."),
});
export type CastVotesInput = z.infer<typeof castVotesSchema>;

// Shape returned by the Gemini AI summary call, validated before persisting.
export const aiSummaryResponseSchema = z.object({
  summary: z.string().min(1).max(2000),
  winner: z.string().max(150).nullable(),
  winner_votes: z.number().int().min(0).nullable(),
  winner_percentage: z.number().min(0).max(100).nullable(),
  margin: z.number().min(0).nullable(),
  is_tie: z.boolean().default(false),
});
export type AiSummaryResponse = z.infer<typeof aiSummaryResponseSchema>;
