import Link from "next/link";
import {
  BarChart3,
  LayoutDashboard,
  ListOrdered,
  Users,
  Vote as VoteIcon,
} from "lucide-react";
import { BrandLockup } from "@/components/election/logo";
import { LogoutButton } from "@/components/election/logout-button";
import { requireAdmin } from "@/lib/auth/helpers";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/elections", label: "Elections", icon: VoteIcon },
  { href: "/admin/positions", label: "Positions", icon: ListOrdered },
  { href: "/admin/members", label: "Class Members", icon: Users },
  { href: "/admin/results", label: "Results", icon: BarChart3 },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:flex md:flex-col">
        <div className="flex h-16 items-center border-b border-border px-5">
          <BrandLockup compact />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="focus-ring flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              <item.icon className="h-4 w-4 text-primary" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <Link
            href="/"
            className="focus-ring block rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary"
          >
            &larr; Back to member site
          </Link>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
          <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Admin Portal
          </p>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">
              {admin.nickname ?? "Admin"}
            </span>
            <LogoutButton />
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="focus-ring whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
