import Link from "next/link";
import { TaxeeLogoMark } from "@/components/landing/taxee-logo-mark";

export function TaxeeLogo({ showWordmark = false }: { showWordmark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 text-[#111827] dark:text-[#f9fafb]">
      <TaxeeLogoMark
        className="h-8 w-[27px] sm:h-9 sm:w-[31px]"
        title="taxee"
      />
      {showWordmark ? (
        <span className="font-landing text-[15px] font-semibold tracking-tight">
          taxee
        </span>
      ) : null}
    </span>
  );
}

export function Logo() {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80"
      aria-label="taxee home"
    >
      <TaxeeLogo showWordmark />
    </Link>
  );
}
