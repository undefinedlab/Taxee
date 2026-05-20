export function TaxeeLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden
      >
        <path
          d="M6 26V10L16 6L26 10V26L16 30L6 26Z"
          fill="#111827"
        />
        <path
          d="M16 6V30M6 10L26 22M26 10L6 22"
          stroke="white"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-landing text-[22px] font-bold tracking-tight text-black">
        taxee
      </span>
    </div>
  );
}
