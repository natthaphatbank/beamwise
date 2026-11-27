// Runs before the page paints so it never flashes the wrong theme. Kept out of index.html so the
// Content-Security-Policy can forbid inline scripts.
try { document.documentElement.dataset.theme = localStorage.getItem("wpth-theme") === "light" ? "light" : "dark"; }
catch (e) { document.documentElement.dataset.theme = "dark"; }
