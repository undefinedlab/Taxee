import { cn } from "@/lib/utils";

export function SectionHeader({
  label,
  title,
  description,
  layout = "default",
  className,
}: {
  label?: string;
  title: string;
  description?: string;
  layout?: "default" | "split" | "hero" | "heroRight" | "centered";
  className?: string;
}) {
  if (layout === "hero") {
    return (
      <header className={cn("landing-scroll-section-head max-w-xl", className)}>
        {label ? (
          <p className="font-landing text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7280] dark:text-[#9ca3af]">
            {label}
          </p>
        ) : null}
        <h2
          className={cn(
            "font-serif font-bold leading-[1.08] tracking-tight text-black dark:text-[#f9fafb] text-[2.25rem] sm:text-[2.85rem] lg:text-[3.5rem]",
            label ? "mt-3" : "",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-4 font-landing text-[15px] leading-[1.75] text-[#4b5563] dark:text-[#9ca3af]">
            {description}
          </p>
        ) : null}
      </header>
    );
  }

  if (layout === "heroRight") {
    return (
      <header
        className={cn(
          "landing-scroll-section-head max-w-xl text-left lg:ml-auto",
          className,
        )}
      >
        {label ? (
          <p className="font-landing text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7280] dark:text-[#9ca3af]">
            {label}
          </p>
        ) : null}
        <h2
          className={cn(
            "font-serif text-[2.25rem] font-bold leading-[1.08] tracking-tight text-black dark:text-[#f9fafb] sm:text-[2.85rem] lg:text-[3.5rem]",
            label ? "mt-3" : "",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-4 font-landing text-[15px] leading-[1.75] text-[#4b5563] dark:text-[#9ca3af]">
            {description}
          </p>
        ) : null}
      </header>
    );
  }

  if (layout === "centered") {
    return (
      <header
        className={cn(
          "landing-scroll-section-head mx-auto max-w-2xl text-center",
          className,
        )}
      >
        {label ? (
          <p className="font-landing text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7280] dark:text-[#9ca3af]">
            {label}
          </p>
        ) : null}
        <h2
          className={cn(
            "font-serif text-2xl font-bold leading-tight text-black dark:text-[#f9fafb] sm:text-3xl lg:text-4xl",
            label ? "mt-3" : "",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-4 font-landing text-[15px] leading-[1.75] text-[#4b5563] dark:text-[#9ca3af]">
            {description}
          </p>
        ) : null}
      </header>
    );
  }

  if (layout === "split") {
    return (
      <header
        className={cn(
          "landing-scroll-section-head grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end lg:gap-10",
          className,
        )}
      >
        <div>
          {label ? (
            <p className="font-landing text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7280] dark:text-[#9ca3af]">
              {label}
            </p>
          ) : null}
          <h2
            className={cn(
              "font-serif text-[1.75rem] font-bold leading-[1.12] tracking-tight text-black dark:text-[#f9fafb] sm:text-4xl lg:text-[2.65rem]",
              label ? "mt-3" : "",
            )}
          >
            {title}
          </h2>
        </div>
        {description ? (
          <p className="max-w-md font-landing text-[15px] leading-[1.75] text-[#4b5563] dark:text-[#9ca3af] lg:pb-1 lg:text-right lg:justify-self-end">
            {description}
          </p>
        ) : null}
      </header>
    );
  }

  return (
    <header className={cn("landing-scroll-section-head", className)}>
      {label ? (
        <p className="font-landing text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7280] dark:text-[#9ca3af]">
          {label}
        </p>
      ) : null}
      <h2
        className={cn(
          "max-w-3xl font-serif text-2xl font-bold leading-tight text-black dark:text-[#f9fafb] sm:text-3xl",
          label ? "mt-3" : "",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-4 max-w-2xl font-landing text-[15px] leading-[1.75] text-[#4b5563] dark:text-[#9ca3af]">
          {description}
        </p>
      ) : null}
    </header>
  );
}
