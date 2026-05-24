import {
  SectionIcon,
  type SectionIconName,
} from "@/components/landing/section-icon";
import { PLAIN_ICON_LG_CLASS } from "@/components/landing/icon-sizes";
import { cn } from "@/lib/utils";

export function HowItWorksStep({
  phase,
  icon,
  title,
  description,
  className,
}: {
  phase: number;
  icon: SectionIconName;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex h-full flex-col items-center text-center",
        className,
      )}
    >
      <SectionIcon
        name={icon}
        variant="plain"
        className={cn("mb-6 sm:mb-7", PLAIN_ICON_LG_CLASS)}
      />
      <p className="font-landing text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7280] dark:text-[#9ca3af]">
        Phase {phase}
      </p>
      <h3 className="mt-2 font-landing text-lg font-semibold leading-snug text-black dark:text-[#f9fafb] sm:mt-2.5 sm:text-xl">
        {title}
      </h3>
      <p className="mt-3 max-w-[20rem] flex-1 font-landing text-[13px] leading-[1.65] text-[#4b5563] dark:text-[#9ca3af] sm:mt-3.5 sm:max-w-[22rem] sm:text-[14px]">
        {description}
      </p>
    </article>
  );
}
