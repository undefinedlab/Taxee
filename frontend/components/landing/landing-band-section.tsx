import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const shellClass =
  "landing-card-sharp landing-glass landing-scroll-band landing-scroll-stack";

/** Full-width hero-style glass panel for scroll sections */
export function LandingBandSection({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn(shellClass, className)}>
      {children}
    </section>
  );
}
