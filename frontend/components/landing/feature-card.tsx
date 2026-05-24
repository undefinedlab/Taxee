import { ValueCard } from "@/components/landing/value-card";
import type { SectionIconName } from "@/components/landing/section-icon";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  title: string;
  description: string;
  tag?: string;
  icon?: SectionIconName;
  metric?: string;
  metricLabel?: string;
  accent?: "green" | "blue" | "both";
  href?: string;
  featured?: boolean;
  variant?: "default" | "soft";
  className?: string;
}

/** Feature tile — uses shared value-card layout */
export function FeatureCard({
  title,
  description,
  tag,
  icon,
  metric,
  metricLabel,
  href,
  variant = "soft",
  className,
}: FeatureCardProps) {
  if (!icon) {
    return null;
  }

  return (
    <ValueCard
      icon={icon}
      title={title}
      description={description}
      tag={tag}
      metric={metric}
      metricLabel={metricLabel}
      href={href}
      variant={variant}
      className={cn(className)}
    />
  );
}
