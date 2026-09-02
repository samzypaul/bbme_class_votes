import Image from "next/image";
import { cn } from "@/lib/utils";

export function MubasMark({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-9 w-9 shrink-0", className)}>
      <Image
        src="/images/mubas-logo-full.png"
        alt="MUBAS logo"
        fill
        className="object-contain"
      />
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
