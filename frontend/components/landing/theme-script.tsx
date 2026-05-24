/** Runs before paint — default dark unless user chose light */
export function ThemeScript() {
  const script = `(function(){try{var k='taxee-theme',t=localStorage.getItem(k);if(t==='light')document.documentElement.classList.remove('dark');else document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`;
  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}
