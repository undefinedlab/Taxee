import { cn } from "@/lib/utils";

export function SectionBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-black px-3.5 py-1.5 font-landing text-[11px] font-semibold tracking-wide text-white dark:bg-[#f9fafb] dark:text-[#111827]",
        className,
      )}
    >
      {children}
    </span>
  );
}
