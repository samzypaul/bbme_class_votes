"use client";

import Link from "next/link";
import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLockup } from "@/components/election/logo";
import { registerAction, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = {};

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(registerAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <BrandLockup />
          <CardTitle className="mt-4 flex items-center gap-2 text-2xl">
            <UserPlus className="h-5 w-5 text-primary" />
            Create an admin account
          </CardTitle>
          <CardDescription>
            For Welfare Board administrators only -- members vote without an account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@example.com" />
              {state.fieldErrors?.email && (
                <p className="text-sm text-destructive">{state.fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nickname">Nickname / Display Name</Label>
              <Input id="nickname" name="nickname" required placeholder="e.g. Sam" maxLength={40} />
              <p className="text-xs text-muted-foreground">
                Shown to you in the admin portal header.
              </p>
              {state.fieldErrors?.nickname && (
                <p className="text-sm text-destructive">{state.fieldErrors.nickname}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required minLength={8} />
              {state.fieldErrors?.password && (
                <p className="text-sm text-destructive">{state.fieldErrors.password}</p>
              )}
            </div>

            {state.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-destructive">
                {state.error}
              </p>
            )}

            <Button type="submit" className="w-full" loading={isPending}>
              Create Account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
