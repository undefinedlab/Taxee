/** Runs before paint — dark mode only (light toggle hidden for now) */
export function ThemeScript() {
  const script = `(function(){try{document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`;
  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}
