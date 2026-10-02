// Read the stored theme before first paint so the page never flashes
// (website.md section 2). Injected into <head> by both root layouts.
// The theme lives in `data-theme` on <html>, NOT in `class`: React renders <html className>
// (the font variables) and resets it on hydration, which silently dropped a `dark` class.
export const themeScript = `(function(){try{var s=localStorage.getItem("accord-theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;var e=document.documentElement;e.setAttribute("data-theme",d?"dark":"light");e.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
