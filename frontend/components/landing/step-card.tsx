import Link from "next/link";
import { SectionIcon, type SectionIconName } from "@/components/landing/section-icon";
import { cn } from "@/lib/utils";

export function StepCard({
  step,
  icon,
  title,
  description,
  tag,
  metric,
  metricLabel,
  href,
  className,
}: {
  step: number;
  icon: SectionIconName;
  title: string;
  description: string;
  tag?: string;
  metric?: string;
  metricLabel?: string;
  href?: string;
  className?: string;
}) {
  return (
    <article className={cn("flex h-full flex-col", className)}>
      <div className="landing-showcase-panel mb-6 flex min-h-[200px] flex-col items-center justify-center rounded-[1.5rem] p-6 sm:min-h-[220px]">
        <SectionIcon
          name={icon}
          className="mb-4 h-14 w-14 [&_svg]:h-7 [&_svg]:w-7"
        />
        {metric ? (
          <div className="text-center">
            <p className="font-landing text-2xl font-bold text-white">{metric}</p>
            {metricLabel ? (
              <p className="mt-1 font-landing text-[11px] text-[#9ca3af]">
                {metricLabel}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="font-landing text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7280] dark:text-[#9ca3af]">
        {tag ?? `Step ${step}`}
      </p>
      <h3 className="mt-2 font-landing text-lg font-semibold text-black dark:text-[#f9fafb] sm:text-xl">
        {title}
      </h3>
      <p className="mt-3 flex-1 font-landing text-[14px] leading-[1.7] text-[#4b5563] dark:text-[#9ca3af]">
        {description}
      </p>
      {href ? (
        <Link href={href} className="group mt-6 inline-flex items-center gap-2 font-landing text-[13px] font-medium text-black dark:text-[#f9fafb]">
          Learn more
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e7eb] dark:border-[#374151]">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M5 10h10M11 6l4 4-4 4" />
            </svg>
          </span>
        </Link>
      ) : null}
    </article>
  );
}
