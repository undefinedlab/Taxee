import Link from "next/link";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  title: string;
  description: string;
  tag?: string;
  metric?: string;
  metricLabel?: string;
  accent?: "green" | "blue" | "both";
  href?: string;
  className?: string;
}

export function FeatureCard({
  title,
  description,
  tag,
  metric,
  metricLabel,
  accent = "green",
  href,
  className,
}: FeatureCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {accent === "green" || accent === "both" ? (
            <span className="h-2.5 w-2.5 bg-[#3dcc4e]" />
          ) : null}
          {accent === "blue" || accent === "both" ? (
            <span className="h-2.5 w-2.5 bg-[#4a9eed]" />
          ) : null}
          {tag && (
            <span className="font-landing text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b7280] dark:text-[#9ca3af]">
              {tag}
            </span>
          )}
        </div>
        {metric && (
          <div className="text-right">
            <p className="font-landing text-xl font-bold text-black dark:text-[#f9fafb]">
              {metric}
            </p>
            {metricLabel && (
              <p className="font-landing text-[10px] text-[#9ca3af]">
                {metricLabel}
              </p>
            )}
          </div>
        )}
      </div>
      <h3 className="mt-4 font-landing text-lg font-semibold text-black dark:text-[#f9fafb]">
        {title}
      </h3>
      <p className="mt-3 font-landing text-[13px] leading-[1.65] text-[#4b5563] dark:text-[#9ca3af]">
        {description}
      </p>
    </>
  );

  const baseClass = cn(
    "landing-grid-line landing-glass-cell flex h-full flex-col border p-7 sm:p-8 lg:p-10",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {content}
      </Link>
    );
  }

  return <div className={baseClass}>{content}</div>;
}
