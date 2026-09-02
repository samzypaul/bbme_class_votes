"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/actions/auth";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      loading={isPending}
      onClick={() => startTransition(() => signOutAction())}
    >
      <LogOut />
      Logout
    </Button>
  );
}
