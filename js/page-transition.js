/* Moving between pages (the animations are in css/site.css, under "page transition"). Loaded in the
   <head> of every page so it's ready before the page first appears.
   - Chrome, Edge and Safari 18.2+ animate between pages themselves (cross-page View Transitions): the page
     you're leaving dims while the new one opens from a strip in the middle. Between the pages on the Black and
     White screen (the Collection page, the entire checklist and the language pages), they cross-fade quickly
     instead, like the game's screens (.vt-art on <html>).
   - Where that isn't supported (Firefox, older Safari), or the browser skips a transition, the site plays the
     same one itself: a link dims the page before leaving (.pt-leave), and the next page opens over a dark
     backdrop (.pt-enter). */
(function () {
  "use strict";
  var root = document.documentElement, KEY = "xscizorr-pt";
  var native = "onpagereveal" in window;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function enter() {
    if (reduce || root.classList.contains("pt-enter")) return;
    root.classList.add("pt-enter");
    setTimeout(function () { root.classList.remove("pt-enter"); }, 1700);
  }
  function sitePage(url) { return /\/(collection|checklist|language)\.html/.test(url); }

  if (native) {
    window.addEventListener("pagereveal", function (e) {
      var act = window.navigation && navigation.activation, from = act && act.from && act.from.url;
      if (!from || act.navigationType === "reload") return;
      try { if (new URL(from).origin !== location.origin) return; } catch (x) { return; }
      var vt = e.viewTransition, t0 = performance.now();
      if (!vt) { enter(); return; }   // no transition came through: play ours
      // or it was skipped before it started (not later on, when the page is already showing)
      vt.ready.catch(function () { if (performance.now() - t0 < 400) enter(); });
      if (sitePage(from) && sitePage(location.pathname)) {
        root.classList.add("vt-art");
        var done = function () { root.classList.remove("vt-art"); };
        vt.finished.then(done, done); // whether it plays out or not
      }
    });
    return;
  }

  // Without View Transitions: arriving from another page of the site, open over the dark backdrop
  try { if (sessionStorage.getItem(KEY)) { sessionStorage.removeItem(KEY); enter(); } } catch (e) {}
  // and leaving by a link to another page of the site, dim this one first
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank" || a.hasAttribute("download")) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (x) { return; }
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return; // same page: a jump, not a new page
    e.preventDefault();
    try { sessionStorage.setItem(KEY, "1"); } catch (x) {}
    if (reduce) { location.href = url.href; return; }
    root.classList.add("pt-leave");
    setTimeout(function () { location.href = url.href; }, 450);
  });
  // Coming back with the Back button, the page may be shown exactly as it was left: undim it
  window.addEventListener("pageshow", function () { root.classList.remove("pt-leave"); });
})();
