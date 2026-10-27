/* The Collection page: a menu like the touch screen in Pokémon Black and White, six boxes on grid paper
   between a status bar and a bar with a red ✕ (styles in css/collection.css). Pointing at a box makes it glow
   blue and its icon hop. "All language masterset" opens a second screen that asks how to see it: the entire
   checklist (checklist.html), or by language (a third screen with a box for every language, each linking to
   that language's page, language.html). The other five are still to come. */
(function () {
  "use strict";
  var S = window.Scizor, esc = S.esc;
  var $ = function (id) { return document.getElementById(id); };
  var dsm = $("dsm");
  if (!dsm) return;

  // Old links into the tracker that used to be on this page now go to the language pages
  function forwardOldLink() {
    var h = {};
    location.hash.replace(/^#/, "").split("&").forEach(function (kv) { var i = kv.indexOf("="); if (i > 0) h[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
    var moved = h.card ? S.cardURL(h.card) : h.lang ? S.langURL(h.lang) : h.art ? S.artURL(h.art) : "";
    if (moved && moved !== "collection.html") { location.replace(moved); return true; }
    return false;
  }
  if (forwardOldLink()) return;
  S.initChrome();
  var FLAGS = window.SCIZOR_FLAGS || {};
  function pad(n) { return String(n).padStart(2, "0"); }

  // The icons and the clock are shared with the entire checklist (js/ds.js)
  var DS = window.ScizorDS, pixels = DS.pixels;

  // ------------------------------------------------------------ the main menu
  // In the same places as the game's: Pokémon, Pokédex / Bag, Trainer / Save, Options
  var MAIN = [
    { label: "All language masterset", icon: "ball", go: "masterset" },
    { label: "Gallery", icon: "dex" },
    { label: "Misc", icon: "bag" },
    { label: "About", icon: "card" },
    { label: "Contact", icon: "book" },
    { label: "Play", icon: "ds" }
  ];
  $("dsmMain").innerHTML = MAIN.map(function (m) {
    return '<button class="dsm-box" type="button"' + (m.go ? ' data-go="' + m.go + '"' : ' data-soon') + '>' +
      '<span class="dsm-icon">' + pixels(m.icon) + '</span><span class="dsm-label">' + esc(m.label) + '</span></button>';
  }).join("");

  // The menu font has no "·" or brackets: square dots go between the parts of a second line, and a name with
  // brackets is said another way
  var DOT = '<i class="dsm-dot"></i>', NAMES = { LA: "Latin American Spanish" };

  // ------------------------------------------------------------ all language masterset: how to see it
  var cards = S.cards().filter(function (c) { return c.cat === "set"; });
  var langs = S.collectionLangs().map(function (l) {
    return { code: l.code, name: NAMES[l.code] || l.name, t: S.tally(cards.filter(function (c) { return c.lang === l.code; })) };
  });
  var MASTER = [
    { label: "Entire checklist", icon: "list", href: "checklist.html", small: cards.length + " cards" },
    { label: "By language", icon: "globe", href: "#languages", small: langs.length + " languages" }
  ];
  $("dsmMaster").innerHTML = MASTER.map(function (m) {
    return '<a class="dsm-box" href="' + esc(m.href) + '"><span class="dsm-icon">' + pixels(m.icon) + '</span>' +
      '<span class="dsm-label">' + esc(m.label) + '<small>' + esc(m.small) + '</small></span></a>';
  }).join("");

  // ------------------------------------------------------------ the languages
  $("dsmLangs").innerHTML = langs.map(function (l, i) {
    var t = l.t;
    return '<a class="dsm-box dsm-lang" href="' + esc(S.langURL(l.code)) + '" data-code="' + l.code + '">' +
      '<span class="dsm-icon dsm-flag">' + (FLAGS[l.code] || "") + '</span>' +
      '<span class="dsm-label">' + esc(l.name) + '<small>' + pad(i + 1) + DOT + S.pctText(t) + DOT + t.ob + '/' + t.total + '</small></span></a>';
  }).join("");

  // ------------------------------------------------------------ screens
  // The main menu; all language masterset (collection.html#masterset); or the languages (#languages, or #JA
  // from a language page, which lights up that language). The ✕ goes back a screen, and from the menu to the
  // homepage.
  var SCREENS = {
    main: { el: $("dsmMain"), back: "index.html", say: "" },
    masterset: { el: $("dsmMaster"), back: "#", say: "Entire checklist or by language?" },
    languages: { el: $("dsmLangs"), back: "#masterset", say: "Which language?" }
  };
  var msg = $("dsmMsg"), x = $("dsmX"), msgTimer;
  function say(text) { msg.textContent = text; }
  function show() {
    var key = decodeURIComponent(location.hash.slice(1)).toUpperCase(), lang = -1;
    langs.forEach(function (l, i) { if (l.code === key) lang = i; });
    var screen = key === "MASTERSET" ? "masterset" : key === "LANGUAGES" || lang >= 0 ? "languages" : "main";
    for (var k in SCREENS) SCREENS[k].el.hidden = k !== screen;
    x.href = SCREENS[screen].back;
    x.setAttribute("aria-label", screen === "main" ? "Close the menu (home)" : "Back");
    clearTimeout(msgTimer);
    say(SCREENS[screen].say);
    Array.prototype.forEach.call(dsm.querySelectorAll(".dsm-lang"), function (b, i) { b.classList.toggle("is-on", i === lang); });
    if (lang >= 0) dsm.querySelectorAll(".dsm-lang")[lang].scrollIntoView({ block: "nearest", behavior: "instant" });
  }
  dsm.addEventListener("click", function (e) {
    var b = e.target.closest(".dsm-box");
    if (b && b.hasAttribute("data-go")) { location.hash = b.getAttribute("data-go"); return; }
    if (b && b.hasAttribute("data-soon")) {
      say(b.textContent.trim().toUpperCase() + " is coming soon!");
      clearTimeout(msgTimer); msgTimer = setTimeout(function () { say(""); }, 2600);
    }
  });
  x.addEventListener("click", function (e) {
    var to = x.getAttribute("href");
    if (to.charAt(0) !== "#") return;
    e.preventDefault();
    history.pushState(null, "", to === "#" ? location.pathname : to); show();
    var first = dsm.querySelector(".dsm-grid:not([hidden]) .dsm-box"); if (first) first.focus({ preventScroll: true });
  });
  window.addEventListener("hashchange", function () { if (!forwardOldLink()) show(); });
  window.addEventListener("popstate", show);
  // Leaving the lit-up language for another one: only the one under the pointer glows
  $("dsmLangs").addEventListener("pointerover", function (e) { if (e.target.closest(".dsm-lang")) Array.prototype.forEach.call(dsm.querySelectorAll(".dsm-lang.is-on"), function (b) { b.classList.remove("is-on"); }); });

  DS.clock($("dsmClock"));

  show();
})();
