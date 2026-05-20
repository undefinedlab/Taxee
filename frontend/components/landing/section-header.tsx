export function SectionHeader({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="landing-grid-line border-b px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
      <p className="font-landing text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7280] dark:text-[#9ca3af]">
        {label}
      </p>
      <h2 className="mt-2 max-w-3xl font-serif text-2xl font-bold leading-tight text-black dark:text-[#f9fafb] sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 max-w-2xl font-landing text-[15px] leading-relaxed text-[#4b5563] dark:text-[#9ca3af]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
