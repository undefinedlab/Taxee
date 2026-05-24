import Link from "next/link";
import { CardActionButton } from "@/components/landing/card-action-button";
import { SectionIcon, type SectionIconName } from "@/components/landing/section-icon";
import { cn } from "@/lib/utils";

/** Proto-style compact block for 2×2 grids */
export function CompactFeatureBlock({
  icon,
  title,
  description,
  tag,
  href,
  className,
}: {
  icon: SectionIconName;
  title: string;
  description: string;
  tag?: string;
  href?: string;
  className?: string;
}) {
  const inner = (
    <>
      <div className="flex items-start gap-4">
        <SectionIcon name={icon} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          {tag ? (
            <p className="mb-1.5 font-landing text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b7280] dark:text-[#9ca3af]">
              {tag}
            </p>
          ) : null}
          <h3 className="font-landing text-[15px] font-semibold leading-snug text-black dark:text-[#f9fafb]">
            {title}
          </h3>
          <p className="mt-2 font-landing text-[13px] leading-[1.65] text-[#4b5563] dark:text-[#9ca3af]">
            {description}
          </p>
        </div>
      </div>
      {href ? <CardActionButton decorative className="mt-4" /> : null}
    </>
  );

  const shell = cn("landing-scroll-card-soft flex h-full flex-col p-5 sm:p-6", className);

  if (href) {
    return (
      <Link href={href} className={cn(shell, "group")}>
        {inner}
      </Link>
    );
  }

  return <article className={shell}>{inner}</article>;
}
