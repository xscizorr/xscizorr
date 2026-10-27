/* Light or dark: the site starts dark, and the theme button (js/core.js) remembers a switch to light.
   Loaded in the <head> of every page, so a page never shows the wrong one first. */
(function () {
  var saved = null;
  try { saved = localStorage.getItem("xscizorr-mode"); } catch (e) {}
  document.documentElement.setAttribute("data-theme", saved === "light" ? "light" : "dark");
})();
