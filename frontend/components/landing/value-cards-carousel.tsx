"use client";

import { useCallback, useEffect, useState } from "react";
import { ValueCard } from "@/components/landing/value-card";
import type { SectionIconName } from "@/components/landing/section-icon";
import { cn } from "@/lib/utils";

const INTERVAL_MS = 3000;

export type CarouselCardItem = {
  icon?: SectionIconName;
  title: string;
  description: string;
  href?: string;
};

export function ValueCardsCarousel({
  items,
  ariaLabel,
  emphasis = "default",
  minimal = false,
}: {
  items: readonly CarouselCardItem[];
  ariaLabel: string;
  emphasis?: "default" | "large";
  minimal?: boolean;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const isLarge = emphasis === "large";

  const goTo = useCallback((index: number) => {
    setActive(index);
    setPaused(true);
  }, []);

  useEffect(() => {
    if (paused || items.length < 2) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % items.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, items.length]);

  useEffect(() => {
    if (!paused) return;
    const id = window.setTimeout(() => setPaused(false), INTERVAL_MS * 4);
    return () => window.clearTimeout(id);
  }, [paused, active]);

  if (minimal) {
    return (
      <div
        className="flex h-full w-full min-w-0 flex-col"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 items-center"
          aria-live="polite"
          aria-atomic="true"
        >
          {items.map((itm, index) => (
            <div
              key={itm.title}
              className={cn(
                "col-start-1 row-start-1 flex h-full min-h-0 flex-col items-center justify-center text-center transition-opacity duration-500 ease-in-out",
                index === active
                  ? "z-[1] opacity-100"
                  : "pointer-events-none z-0 opacity-0",
              )}
              aria-hidden={index !== active}
            >
              <p className="max-w-xs font-landing text-3xl font-bold leading-tight text-black dark:text-white sm:max-w-sm sm:text-4xl lg:max-w-md lg:text-5xl">
                {itm.title}
              </p>
              <p className="mt-6 max-w-sm font-landing text-[14px] leading-[1.7] text-[#4b5563] dark:text-[#9ca3af]">
                {itm.description}
              </p>
            </div>
          ))}
        </div>

        <div
          className="mt-12 flex shrink-0 items-center justify-center gap-2"
          role="tablist"
          aria-label={ariaLabel}
        >
          {items.map((itm, index) => (
            <button
              key={itm.title}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={itm.title}
              onClick={() => goTo(index)}
              className={cn(
                "rounded-full transition-all duration-300",
                index === active
                  ? "h-2.5 w-2.5 bg-landing-active"
                  : "h-2 w-2 bg-[#9ca3af]/40 hover:bg-[#9ca3af]/65 dark:bg-[#6b7280]/55",
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full min-w-0 flex-col",
        isLarge ? "min-h-[300px] lg:min-h-0" : "min-h-[260px] lg:min-h-0",
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1"
        aria-live="polite"
        aria-atomic="true"
      >
        {items.map((item, index) => (
          <div
            key={item.title}
            className={cn(
              "col-start-1 row-start-1 flex h-full min-h-0 transition-opacity duration-500 ease-in-out",
              index === active
                ? "z-[1] opacity-100"
                : "pointer-events-none z-0 opacity-0",
            )}
            aria-hidden={index !== active}
          >
            <ValueCard
              icon={item.icon}
              title={item.title}
              description={item.description}
              href={item.href}
              layout="row"
              size="lg"
              titleSize={isLarge ? "xl" : "lg"}
              iconScale={isLarge ? "xl" : "lg"}
              iconVariant="plain"
              fillHeight
              className="h-full min-h-full"
            />
          </div>
        ))}
      </div>

      <div
        className="mt-12 flex shrink-0 items-center justify-center gap-2"
        role="tablist"
        aria-label={ariaLabel}
      >
        {items.map((item, index) => (
          <button
            key={item.title}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-label={item.title}
            onClick={() => goTo(index)}
            className={cn(
              "rounded-full transition-all duration-300",
              index === active
                ? "h-2.5 w-2.5 bg-landing-active"
                : "h-2 w-2 bg-[#9ca3af]/40 hover:bg-[#9ca3af]/65 dark:bg-[#6b7280]/55",
            )}
          />
        ))}
      </div>
    </div>
  );
}
