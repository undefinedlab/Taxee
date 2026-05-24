import { cn } from "@/lib/utils";

/** Dark rounded frame for product mockups — defi ID / Proto hero visual */
export function ShowcasePanel({
  children,
  caption,
  className,
}: {
  children: React.ReactNode;
  caption?: string;
  className?: string;
}) {
  return (
    <figure className={cn("w-full", className)}>
      <div className="landing-showcase-panel flex min-h-[280px] items-center justify-center overflow-hidden rounded-[1.75rem] p-6 sm:min-h-[320px] sm:p-8 lg:rounded-[2rem] lg:p-10">
        {children}
      </div>
      {caption ? (
        <figcaption className="mt-4 text-center font-landing text-[12px] leading-relaxed text-[#6b7280] dark:text-[#9ca3af]">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
