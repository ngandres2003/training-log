// Applies the last theme before first paint (kept in sync by src/ui/theme.ts). Light by default.
// A separate file, not an inline script, so the Content-Security-Policy can forbid inline scripts.
;(function () {
  try {
    var t = localStorage.getItem('tl-theme') || 'light'
    if (t === 'system') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    document.documentElement.dataset.theme = t
  } catch {
    document.documentElement.dataset.theme = 'light'
  }
})()
