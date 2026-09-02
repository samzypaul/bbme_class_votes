"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/lib/validation/schemas";

export interface AuthActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    nickname: formData.get("nickname"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path[0] as string] = issue.message;
    }
    return { error: "Please fix the errors below.", fieldErrors };
  }

  const { email, nickname, password } = parsed.data;
  const supabase = await createClient();

  const { data: existingNickname } = await supabase
    .from("profiles")
    .select("id")
    .ilike("nickname", nickname)
    .maybeSingle();

  if (existingNickname) {
    return {
      error: "That nickname is already taken. Please choose another.",
      fieldErrors: { nickname: "Nickname already taken." },
    };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname } },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "An account with that email already exists. Try logging in instead." };
    }
    return { error: error.message };
  }

  redirect("/login?registered=1");
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Invalid email or password." };
  }

  const redirectTo = (formData.get("redirectTo") as string) || "/admin";
  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
