import Link from "next/link";
import { TaxeeLogo } from "@/components/landing/logo";
import { NewsMarquee } from "@/components/landing/news-marquee";

export function HeroTopBar() {
  return (
    <header className="landing-area-hero-topbar landing-grid-line flex items-center gap-3 border-b border-[#e5e7eb] px-4 py-3 dark:border-[#262626] sm:gap-4 sm:px-5 lg:px-6">
      <Link href="/" className="shrink-0" aria-label="taxee home">
        <TaxeeLogo showWordmark />
      </Link>

      <NewsMarquee />
    </header>
  );
}
