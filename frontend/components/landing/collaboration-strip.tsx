const partners = [
  { name: "DeFi.com", display: "defi.com" },
  { name: "Circle", display: "Circle" },
  { name: "Arc", display: "Arc" },
];

export function CollaborationStrip() {
  return (
    <div className="landing-card-sharp border border-[#e5e7eb] bg-white px-6 py-10 dark:border-[#1f2937] dark:bg-[#0f1419] sm:px-10 sm:py-12 lg:px-14 lg:py-14">
      <p className="text-center font-landing text-[11px] font-medium uppercase tracking-[0.2em] text-[#9ca3af] dark:text-[#6b7280]">
        In collaboration with
      </p>
      <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6 sm:gap-x-16 lg:gap-x-20">
        {partners.map((partner) => (
          <li key={partner.name}>
            <span
              className="font-landing text-xl font-semibold tracking-tight text-[#1f2937] dark:text-[#e5e7eb] sm:text-2xl lg:text-[1.65rem]"
              aria-label={partner.name}
            >
              {partner.display}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
