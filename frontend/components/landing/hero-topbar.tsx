import Link from "next/link";
import { TaxeeLogo } from "@/components/landing/logo";
import { HeroProfileMenu } from "@/components/landing/hero-profile-menu";
import { NewsMarquee } from "@/components/landing/news-marquee";

export function HeroTopBar() {
  return (
    <header className="landing-area-hero-topbar landing-grid-line flex items-center gap-3 border-b px-4 py-3 sm:gap-4 sm:px-5 lg:px-6">
      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
        <Link href="/" className="shrink-0">
          <TaxeeLogo />
        </Link>
        <span className="hidden font-landing text-[11px] text-[#9ca3af] sm:inline">
          ©2025taxee
        </span>
      </div>

      <NewsMarquee />

      <div className="flex shrink-0 items-center">
        <HeroProfileMenu />
      </div>
    </header>
  );
}
