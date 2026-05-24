const partners = [
  { name: "DeFi.com", display: "defi.com" },
  { name: "Circle", display: "Circle" },
  { name: "Arc", display: "Arc" },
];

export function CollaborationStrip() {
  return (
    <div className="px-4 pb-6 pt-10 sm:px-6 sm:pb-8 sm:pt-12 lg:pb-10 lg:pt-14">
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
