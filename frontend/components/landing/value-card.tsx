import { CardActionButton } from "@/components/landing/card-action-button";
import {
  PLAIN_ICON_LG_CLASS,
  PLAIN_ICON_LG_GRID_COLS,
  PLAIN_ICON_XL_CLASS,
  PLAIN_ICON_XL_GRID_COLS,
} from "@/components/landing/icon-sizes";
import {
  SectionIcon,
  type SectionIconName,
} from "@/components/landing/section-icon";
import { cn } from "@/lib/utils";

interface ValueCardProps {
  icon?: SectionIconName;
  title: string;
  description: string;
  href?: string;
  tag?: string;
  metric?: string;
  metricLabel?: string;
  variant?: "default" | "soft";
  layout?: "stack" | "row";
  size?: "default" | "lg";
  titleSize?: "default" | "lg" | "xl";
  iconScale?: "lg" | "xl";
  iconVariant?: "default" | "plain";
  fillHeight?: boolean;
  className?: string;
}

export function ValueCard({
  icon,
  title,
  description,
  href,
  tag,
  metric,
  metricLabel,
  variant = "soft",
  layout = "stack",
  size = "default",
  titleSize = "default",
  iconScale = "lg",
  iconVariant = "default",
  fillHeight = false,
  className,
}: ValueCardProps) {
  const isLg = size === "lg";
  const isPlainIcon = iconVariant === "plain";
  const plainIconClass =
    iconScale === "xl" ? PLAIN_ICON_XL_CLASS : PLAIN_ICON_LG_CLASS;
  const plainGridCols =
    iconScale === "xl" ? PLAIN_ICON_XL_GRID_COLS : PLAIN_ICON_LG_GRID_COLS;

  const iconEl = icon ? (
    <SectionIcon
      name={icon}
      variant={iconVariant}
      className={cn(
        isPlainIcon
          ? isLg
            ? plainIconClass
            : "mt-0.5 h-8 w-8 [&_svg]:h-5 [&_svg]:w-5"
          : isLg
            ? "!h-12 !w-12 [&_svg]:!h-6 [&_svg]:!w-6 sm:!h-14 sm:!w-14 sm:[&_svg]:!h-7 sm:[&_svg]:!w-7"
            : layout === "row"
              ? "mt-0.5"
              : "mb-5",
      )}
    />
  ) : null;

  const textBlock = (
    <>
      {tag ? (
        <p className="mb-1.5 font-landing text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b7280] dark:text-[#9ca3af]">
          {tag}
        </p>
      ) : null}
      <h3
        className={cn(
          "font-landing leading-snug text-black dark:text-[#f9fafb]",
          titleSize === "xl"
            ? "text-xl font-bold sm:text-2xl lg:text-[1.875rem]"
            : titleSize === "lg"
              ? "text-lg font-bold sm:text-xl lg:text-2xl"
              : isLg
              ? "text-[15px] font-semibold sm:text-base"
              : layout === "row"
                ? "text-[15px] font-semibold sm:text-base"
                : "text-lg font-semibold sm:text-xl",
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          "font-landing leading-[1.65] text-[#4b5563] dark:text-[#9ca3af]",
          fillHeight && "min-h-0 flex-1 overflow-y-auto",
          titleSize === "xl"
            ? "mt-3 text-[15px] sm:mt-3.5 sm:text-[16px] sm:leading-[1.7]"
            : isLg
            ? "mt-2 text-[13px] sm:mt-2.5 sm:text-[14px]"
            : layout === "row"
              ? "mt-1.5 text-[13px]"
              : "mt-3 flex-1 text-[14px]",
        )}
      >
        {description}
      </p>
      {metric ? (
        <div className="mt-4 border-t border-[#e5e7eb] pt-4 dark:border-[#374151]">
          <p className="font-landing text-xl font-bold tracking-tight text-black dark:text-[#f9fafb]">
            {metric}
          </p>
          {metricLabel ? (
            <p className="mt-1 font-landing text-[11px] text-[#6b7280] dark:text-[#9ca3af]">
              {metricLabel}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const body =
    layout === "row" ? (
      <div
        className={cn(
          "grid h-full w-full min-h-0",
          icon && isLg
            ? cn(plainGridCols, "items-center gap-x-4 sm:gap-x-5")
            : icon
              ? "grid-cols-[auto_1fr] items-start gap-4"
              : "grid-cols-1 items-center"
        )}
      >
        {iconEl ? (
          <div
            className={cn(
              "flex",
              isLg ? "items-center justify-center" : "items-start",
            )}
          >
            {iconEl}
          </div>
        ) : null}
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-col",
            fillHeight && "h-full flex-1",
            isLg && !fillHeight && "justify-center gap-0",
            isLg && fillHeight && "justify-between",
          )}
        >
          {textBlock}
        </div>
      </div>
    ) : (
      <div className="flex h-full min-h-0 flex-col">
        {iconEl}
        <div className={cn("flex min-w-0 flex-1 flex-col", !isPlainIcon && "mt-0")}>
          {textBlock}
        </div>
      </div>
    );

  return (
    <article
      className={cn(
        "group flex h-full flex-col",
        variant === "soft" ? "landing-scroll-card-soft" : "landing-scroll-card",
        layout === "row" && !isLg && "p-5 sm:p-6",
        isLg && !fillHeight && "min-h-[180px] p-6 sm:min-h-[190px] sm:p-7",
        isLg && fillHeight && "min-h-0 p-6 sm:p-7",
        className,
      )}
    >
      {body}
      {href ? <CardActionButton href={href} label={title} /> : null}
    </article>
  );
}
