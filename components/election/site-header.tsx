import Link from "next/link";
import { BrandLockup } from "@/components/election/logo";
import { LogoutButton } from "@/components/election/logout-button";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/types/database";

export function SiteHeader({ profile }: { profile: Profile | null }) {
  const isAdmin = profile?.role === "admin";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="focus-ring rounded-lg">
          <BrandLockup compact />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">Home</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/vote">Election</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/results">Results</Link>
          </Button>
          {isAdmin && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin">Admin</Link>
            </Button>
          )}
        </nav>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
              Hi, {profile.nickname ?? "Admin"}
            </span>
            <LogoutButton />
          </div>
        )}
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-1.5 md:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">Home</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/vote">Election</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/results">Results</Link>
        </Button>
        {isAdmin && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin">Admin</Link>
          </Button>
        )}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <p className="font-semibold text-foreground">
          MUBAS Biomedical Engineering &middot; Class of 2025
        </p>
        <p className="mt-1 max-w-2xl">
          An alumni-built welfare board election platform for the Class of 2025. This
          application is run by class members for class members and is not an official
          university system.
        </p>
        <Link
          href="/login"
          className="focus-ring mt-4 inline-block text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Board Admin Login
        </Link>
      </div>
    </footer>
  );
}
