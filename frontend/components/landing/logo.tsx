import Image from "next/image";
import Link from "next/link";

export function TaxeeLogo({ showWordmark = false }: { showWordmark?: boolean }) {
  return (
    <span className="flex items-center gap-3 text-[#111827] dark:text-[#f9fafb]">
      <Image
        src="/logo-mark.png"
        alt=""
        width={36}
        height={36}
        className="h-8 w-auto sm:h-9 dark:invert"
        priority
      />
      {showWordmark ? (
        <span className="font-serif text-[1.35rem] font-bold leading-none tracking-tight sm:text-2xl">
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
