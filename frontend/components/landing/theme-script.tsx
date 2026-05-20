/** Runs before paint to avoid theme flash on landing */
export function ThemeScript() {
  const script = `(function(){try{var k='taxee-theme',t=localStorage.getItem(k);if(t==='dark')document.documentElement.classList.add('dark');else if(t==='light')document.documentElement.classList.remove('dark');}catch(e){}})();`;
  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}
