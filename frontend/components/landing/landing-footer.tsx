import Link from "next/link";
import { TaxeeLogoMark } from "@/components/landing/taxee-logo-mark";

const columns = [
  {
    title: "Community",
    links: [
      { label: "Discord", href: "https://discord.gg" },
      { label: "Twitter", href: "https://twitter.com" },
    ],
  },
  {
    title: "Legals",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
  {
    title: "Dev",
    links: [
      { label: "Docs", href: "#" },
      { label: "GitHub", href: "https://github.com" },
    ],
  },
] as const;

export function LandingFooter() {
  return (
    <footer className="landing-footer mx-auto max-w-[1320px] border-t border-[#e5e7eb] px-4 py-12 sm:px-6 lg:px-8 dark:border-[#1f2937]">
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <TaxeeLogoMark className="h-9 w-[31px] text-[#111827] dark:text-[#f9fafb]" />
          <div>
            <p className="font-landing text-sm font-semibold text-[#111827] dark:text-[#f9fafb]">
              taxee
            </p>
            <p className="font-landing text-xs text-[#6b7280] dark:text-[#9ca3af]">
              © {new Date().getFullYear()} taxee
            </p>
          </div>
        </div>

        <div className="grid flex-1 gap-8 sm:grid-cols-3 sm:gap-6 lg:max-w-xl lg:justify-items-end">
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-landing text-xs font-bold uppercase tracking-[0.12em] text-[#111827] dark:text-[#f9fafb]">
                {col.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="font-landing text-sm text-[#6b7280] transition-colors hover:text-[#111827] dark:text-[#9ca3af] dark:hover:text-[#f9fafb]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
