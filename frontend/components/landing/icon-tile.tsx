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
        className="mb-6 h-16 w-16 [&_svg]:h-9 [&_svg]:w-9 sm:mb-7 sm:h-20 sm:w-20 sm:[&_svg]:h-11 sm:[&_svg]:w-11"
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
