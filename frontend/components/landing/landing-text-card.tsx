import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Plain text block — hover on the card only, not the glass section shell */
export function LandingTextCard({
  children,
  className,
  align = "center",
}: {
  children: ReactNode;
  className?: string;
  align?: "center" | "left";
}) {
  return (
    <article
      className={cn(
        "landing-text-card",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </article>
  );
}
