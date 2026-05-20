import Link from "next/link";

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
  const year = new Date().getFullYear();

  return (
    <footer className="landing-footer mx-auto max-w-[1320px] px-4 pb-14 pt-10 sm:px-6 sm:pt-12">
      <div className="mx-auto grid max-w-2xl grid-cols-1 gap-10 text-center sm:grid-cols-3 sm:gap-8">
        {columns.map((col) => (
          <div key={col.title} className="flex flex-col items-center">
            <h3 className="font-landing text-xs font-bold uppercase tracking-[0.12em] text-[#111827] dark:text-[#f9fafb]">
              {col.title}
            </h3>
            <ul className="mt-4 space-y-2">
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

      <p className="mt-12 text-center font-landing text-xs text-[#9ca3af] dark:text-[#6b7280]">
        © {year} taxee
      </p>
    </footer>
  );
}
