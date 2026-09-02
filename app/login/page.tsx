"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLockup } from "@/components/election/logo";
import { loginAction, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = {};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/admin";
  const justRegistered = searchParams.get("registered") === "1";
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <BrandLockup />
          <CardTitle className="mt-4 flex items-center gap-2 text-2xl">
            <LogIn className="h-5 w-5 text-primary" />
            Admin Sign In
          </CardTitle>
          <CardDescription>
            For Welfare Board administrators. Looking to vote?{" "}
            <Link href="/vote" className="font-semibold text-primary hover:underline">
              Go to the election
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {justRegistered && (
            <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
              Account created. Please check your email if confirmation is required, then log in.
            </p>
          )}

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@example.com" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>

            {state.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-destructive">
                {state.error}
              </p>
            )}

            <Button type="submit" className="w-full" loading={isPending}>
              Log In
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold text-primary hover:underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
