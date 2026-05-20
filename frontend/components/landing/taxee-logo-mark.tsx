/** Vector mark — bird / “t” silhouette from brand asset */
export function TaxeeLogoMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 44 52"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : "presentation"}
      aria-hidden={!title}
    >
      {title ? <title>{title}</title> : null}
      {/* Head + neck + body */}
      <path d="M4.5 11.2 25.8 8.6c5.6-.5 10.8 2.6 12.4 8.1.7 2.4-.1 4.9-2.2 6.3l-7.2 4.4c-1.2.7-1.9 2-1.9 3.4v.8c0 1-.4 2-1.1 2.7l-2.8 2.5c-2.2 2-3.5 4.8-3.5 7.7v12.8c0 1.6 1.3 2.9 2.9 2.9h6.2c1.6 0 2.9-1.3 2.9-2.9V27.4c0-2.7 1.2-5.3 3.3-7.1l1.2-1c1.3-1.1 2-2.7 2-4.4v-.3c0-1.8-1-3.5-2.7-4.3L29.2 7.8 4.5 11.2z" />
      <circle cx="34.2" cy="14.2" r="2.1" />
      {/* Inner feather bands */}
      <path d="M20.8 29.2c1.5 2.8 2.2 5.9 1.9 9-.1 1-.5 2-1 2.8-.3.6-1 1-1.7 1h-.3c-.8 0-1.4-.5-1.5-1.3-.7-3.3-.1-6.7 1.4-9.6.4-.8 1.4-1.1 2.2-.6.4.3.6.7.7 1.2z" />
      <path d="M23.8 27c1.9 2.4 2.9 5.5 2.9 8.6v7.2c0 .9-.7 1.6-1.6 1.6h-.2c-.9 0-1.6-.7-1.6-1.6v-6.5c0-2.8-.8-5.5-2.2-7.9-.5-.9-.2-2 .7-2.5.9-.5 2-.3 2.5.6l.1.2z" />
    </svg>
  );
}
