import Link from "next/link";
import { cn } from "@/lib/utils";

/** Circular arrow — link, or decorative when already inside a card link */
export function CardActionButton({
  href,
  decorative = false,
  className,
  label = "Learn more",
}: {
  href?: string;
  decorative?: boolean;
  className?: string;
  label?: string;
}) {
  const inner = (
    <span
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-black transition-colors group-hover:border-[#d1d5db] group-hover:bg-[#f9fafb] dark:border-[#374151] dark:bg-[#111827] dark:text-[#f9fafb] dark:group-hover:bg-[#1f2937]",
        className,
      )}
      aria-hidden
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M5 10h10M11 6l4 4-4 4" />
      </svg>
    </span>
  );

  if (href && !decorative) {
    return (
      <Link href={href} className="group mt-auto pt-8" aria-label={label}>
        {inner}
      </Link>
    );
  }

  return (
    <span className="mt-auto block pt-8" aria-hidden={decorative}>
      {inner}
    </span>
  );
}
