import Link from "next/link";
import { ProductPreview } from "@/components/landing/product-preview";
import { HeroTopBar } from "@/components/landing/hero-topbar";
import { CollaborationStrip } from "@/components/landing/collaboration-strip";
import { LandingScrollSections } from "@/components/landing/landing-scroll-sections";
import { LandingFooter } from "@/components/landing/landing-footer";
import { hero, heroStats } from "@/components/landing/landing-content";
import { landingNavLinks } from "@/components/landing/nav-links";

export function LandingPage() {
  return (
    <div className="landing-root landing-marble-bg min-h-screen">
      <div className="p-3 sm:p-5 lg:p-8">
        <div className="mx-auto max-w-[1320px] space-y-5 sm:space-y-6">
          <div className="landing-card-sharp landing-animate-in overflow-hidden border border-[#e5e7eb] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.05)] dark:border-[#1f2937] dark:bg-[#0f1419] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
            <div className="landing-bento">
              <HeroTopBar />

              <aside className="landing-area-nav landing-grid-line hidden flex-col border-b lg:flex lg:border-b-0 lg:border-r">
                <nav className="flex flex-1 flex-col gap-1 px-6 py-8 lg:pt-10">
                  {landingNavLinks.map((link, i) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="landing-animate-in font-landing text-[15px] leading-relaxed text-black transition-colors hover:text-[#6b7280] dark:text-[#f3f4f6] dark:hover:text-[#9ca3af]"
                      style={{ animationDelay: `${0.1 + i * 0.04}s` }}
                    >
                      {link.label}
                    </a>
                  ))}
                </nav>
              </aside>

              <div
                id="intelligence"
                className="landing-area-hero landing-grid-line flex flex-col justify-center border-b px-6 py-10 sm:px-8 sm:py-12 lg:border-b-0 lg:border-l lg:px-10 lg:py-10 xl:px-12"
              >
                <div className="landing-animate-in landing-delay-3 flex items-center gap-2">
                  <span className="inline-flex h-3 w-3 bg-[#3dcc4e]" />
                  <span className="inline-block h-3 w-3 bg-[#4a9eed]" />
                  <span className="font-landing text-[10px] font-bold uppercase tracking-[0.14em] text-black dark:text-[#f9fafb]">
                    {hero.eyebrow}
                  </span>
                </div>
                <h1 className="landing-animate-in landing-delay-4 mt-5 font-serif text-[2rem] font-bold leading-[1.08] tracking-tight text-black dark:text-[#f9fafb] sm:text-[2.5rem] lg:text-[2.85rem] xl:text-[3rem]">
                  {hero.title}
                </h1>
                <p className="landing-animate-in landing-delay-5 mt-5 max-w-lg font-landing text-[14px] leading-[1.7] text-[#4b5563] dark:text-[#9ca3af]">
                  {hero.subtitle}
                </p>
                <div className="landing-animate-in landing-delay-6 mt-9 flex flex-wrap items-center gap-5">
                  <Link
                    href="/onboarding"
                    className="group inline-flex items-stretch overflow-hidden bg-black shadow-[0_4px_16px_rgba(0,0,0,0.12)] dark:bg-[#f9fafb] dark:shadow-none"
                  >
                    <span className="flex items-center px-6 py-3.5 font-landing text-[14px] font-medium text-white dark:text-[#111827]">
                      {hero.ctaPrimary}
                    </span>
                    <span className="flex w-[52px] items-center justify-center bg-[#3dcc4e] transition-colors group-hover:bg-[#34b844]">
                      <svg
                        className="landing-cta-arrow"
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="#111827"
                        strokeWidth="2.2"
                        aria-hidden
                      >
                        <path d="M5 10h10M11 6l4 4-4 4" />
                      </svg>
                    </span>
                  </Link>
                  <Link
                    href="/dashboard/demo"
                    className="font-landing text-[14px] font-medium text-black underline-offset-4 hover:underline dark:text-[#f9fafb]"
                  >
                    {hero.ctaSecondary}
                  </Link>
                </div>
              </div>

              <div
                id="preview"
                className="landing-area-dashboard landing-grid-line border-b lg:border-b-0 lg:border-r"
              >
                <ProductPreview />
              </div>

              <div className="landing-area-photo landing-grid-line relative hidden min-h-[200px] overflow-hidden border-b lg:block lg:min-h-[140px] lg:border-b-0 lg:border-r">
                <div className="landing-checker absolute bottom-0 left-0 z-0 h-[45%] w-[55%]" />
                <div className="relative z-10 flex h-full min-h-[140px] flex-col justify-end p-6 lg:p-8">
                  <p className="font-landing text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b7280] dark:text-[#9ca3af]">
                    Why it matters
                  </p>
                  <p className="mt-2 max-w-[200px] font-serif text-lg font-semibold leading-snug text-black dark:text-[#f9fafb]">
                    Gross-optimized ≠ after-tax-optimized
                  </p>
                </div>
              </div>

              <div className="landing-area-stats landing-grid-line landing-animate-in landing-delay-5 grid gap-8 px-6 py-8 sm:grid-cols-3 sm:px-8 lg:border-b-0 lg:px-10 lg:py-10">
                {heroStats.map((stat) => (
                  <div key={stat.label}>
                    <p className="font-landing text-[2rem] font-bold leading-none tracking-tight text-black dark:text-[#f9fafb] lg:text-[2.25rem]">
                      {stat.value}
                    </p>
                    <p className="mt-2 font-landing text-[12px] leading-snug text-[#6b7280] dark:text-[#9ca3af]">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <CollaborationStrip />
        </div>

        <LandingScrollSections />

        <nav
          className="mx-auto mt-10 flex max-w-[1320px] flex-wrap justify-center gap-6 px-4 lg:hidden"
          aria-label="Page sections"
        >
          {landingNavLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-landing text-sm text-[#1f2937] dark:text-[#d1d5db]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <LandingFooter />
      </div>
    </div>
  );
}
