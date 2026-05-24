"use client";

import {
  ValueCardsCarousel,
  type CarouselCardItem,
} from "@/components/landing/value-cards-carousel";
import type { SectionIconName } from "@/components/landing/section-icon";

export type SolutionFeature = {
  icon: SectionIconName;
  title: string;
  description: string;
  href?: string;
};

export function SolutionDecisionsCarousel({
  items,
}: {
  items: readonly SolutionFeature[];
}) {
  const carouselItems: CarouselCardItem[] = items.map((item) => ({
    icon: item.icon,
    title: item.title,
    description: item.description,
    ...(item.href ? { href: item.href } : {}),
  }));

  return (
    <ValueCardsCarousel
      items={carouselItems}
      ariaLabel="What taxee does"
      emphasis="default"
    />
  );
}
