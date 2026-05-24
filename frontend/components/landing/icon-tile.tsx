import {
  SectionIcon,
  type SectionIconName,
} from "@/components/landing/section-icon";
import { cn } from "@/lib/utils";

export function IconTile({
  icon,
  title,
  description,
  className,
}: {
  icon: SectionIconName;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex h-full flex-col items-center px-2 py-4 text-center sm:px-3",
        className,
      )}
    >
      <SectionIcon
        name={icon}
        variant="plain"
        className="mb-5 h-12 w-12 [&_svg]:h-7 [&_svg]:w-7 sm:mb-6 sm:h-14 sm:w-14 sm:[&_svg]:h-8 sm:[&_svg]:w-8"
      />
      <h3 className="font-landing text-[15px] font-semibold leading-snug text-black dark:text-[#f9fafb] sm:text-base">
        {title}
      </h3>
      <p className="mt-2.5 max-w-[14rem] font-landing text-[13px] leading-[1.65] text-[#4b5563] dark:text-[#9ca3af] sm:max-w-none">
        {description}
      </p>
    </article>
  );
}
