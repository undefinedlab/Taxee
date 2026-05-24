import { cn } from "@/lib/utils";

export function HowItWorksStep({
  phase,
  title,
  description,
  className,
}: {
  phase: number;
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
      <p className="font-landing text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7280] dark:text-[#9ca3af]">
        Phase {phase}
      </p>
      <h3 className="mt-3 font-landing text-2xl font-semibold leading-snug text-black dark:text-[#f9fafb] sm:mt-4 sm:text-3xl">
        {title}
      </h3>
      <p className="mt-4 max-w-[20rem] flex-1 font-landing text-[14px] leading-[1.7] text-[#4b5563] dark:text-[#9ca3af] sm:mt-5 sm:max-w-[24rem] sm:text-[15px]">
        {description}
      </p>
    </article>
  );
}
