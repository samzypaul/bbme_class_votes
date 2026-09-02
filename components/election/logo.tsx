import { cn } from "@/lib/utils";

/**
 * Text-based MUBAS emblem. Swap for /public/images/mubas-logo.png (an <Image>
 * tag) if/when an official logo asset is supplied -- see README.
 */
export function MubasMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground",
        className
      )}
      aria-hidden="true"
    >
      M
    </div>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <MubasMark />
      <div className="leading-tight">
        <p className="text-sm font-extrabold tracking-tight text-foreground">MUBAS</p>
        {!compact && (
          <p className="text-xs font-medium text-muted-foreground">
            Biomedical Engineering &middot; Class of 2025
          </p>
        )}
      </div>
    </div>
  );
}
