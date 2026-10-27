/* Homepage: the looping carousel, the progress overview and the artwork gallery. */
(function () {
  "use strict";
  var S = window.Scizor, esc = S.esc;
  var $ = function (id) { return document.getElementById(id); };
  // The obtained parts of the bars are in the same metallic crimson as the heading (css/site.css)
  var COLORS = { ob: "var(--crimson-metal)", tr: "var(--transit)", un: "var(--unobtained)" };
  S.initChrome();

  // ------------------------------------------------------------ carousel slides
  // Your photos (data/carousel.js) when there are any, otherwise your best graded card from each artwork as a slab.
  function gradeRank(g) {
    var m = /(\d+(?:\.\d)?)/.exec(g || ""); var n = m ? parseFloat(m[1]) : 0;
    if (/^raw$/i.test(g)) return 1;
    return n ? 10 + n : 2;
  }
  function slides() {
    var photos = (window.SCIZOR_CAROUSEL || []).filter(function (p) { return p && p.src; });
    if (photos.length) return photos.map(function (p) { return { photo: p }; });
    var best = {};
    S.cards().forEach(function (c) {
      if (c.cat !== "set" || c.status !== "ob" || !c.art) return;
      var cur = best[c.art], score = gradeRank(c.grade) * 10 + (c.lang === "EN" ? 2 : c.lang === "JA" ? 1 : 0);
      if (!cur || score > cur.score) best[c.art] = { card: c, score: score };
    });
    return S.artworks().map(function (a) { return best[a.id]; }).filter(Boolean);
  }
  function gradeParts(g) {
    if (!g || /^raw$/i.test(g)) return { co: "Raw", n: "" };
    var m = /^(\S+)\s*(.*)$/.exec(g); return { co: m[1], n: m[2] };
  }
  function slideHTML(s, i) {
    if (s.photo) {
      return '<figure class="slab photo" tabindex="0" data-i="' + i + '"><img src="' + esc(s.photo.src) + '" alt="' + esc(s.photo.title || "Scizor card") + '" draggable="false"></figure>';
    }
    var c = s.card, gp = gradeParts(c.grade);
    return '<figure class="slab" tabindex="0" data-i="' + i + '" aria-label="' + esc(c.name + ", " + c.set + " " + c.num + ", " + (c.grade || "")) + '">' +
      '<div class="slab-label"><div><b>' + esc(c.name) + ' ' + esc(c.num) + '</b><span>' + esc(c.set) + '</span><span>' + esc(c.type || S.langName(c.lang)) + '</span></div>' +
      '<div class="slab-grade"><small>' + esc(gp.co.toUpperCase()) + '</small><strong>' + esc(gp.n || "-") + '</strong></div></div>' +
      '<div class="slab-well">' + S.face(c) + '</div></figure>';
  }

  var list = slides();
  var track = $("track"), viewport = $("viewport");
  if (!list.length) { document.querySelector(".strip").hidden = true; }
  else {
    var html = list.map(slideHTML).join("");
    // Repeat a short list until one copy is wider than the screen, then add a second copy so the loop is seamless
    var copies = Math.max(1, Math.ceil((Math.max(window.innerWidth, 1400) * 1.3) / (list.length * 250)));
    var unit = new Array(copies + 1).join(html);
    track.innerHTML = unit + unit;
    var perCopy = list.length * copies;
    Array.prototype.forEach.call(track.querySelectorAll(".slab"), function (el, k) {
      if (k >= list.length) { el.setAttribute("aria-hidden", "true"); el.tabIndex = -1; }
    });
    runCarousel(perCopy);
  }

  function runCarousel(perCopy) {
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var x = 0, speed = 34, last = 0, paused = !!reduce, hover = false, drag = null, tween = null;
    var playBtn = $("play");
    // Distance after which the second copy lines up exactly where the first one started
    function half() { var k = track.children; return k[perCopy] ? k[perCopy].offsetLeft - k[0].offsetLeft : track.scrollWidth / 2; }
    function wrap() { var h = half(); if (!h) return; while (x <= -h) x += h; while (x > 0) x -= h; }
    function apply() { track.style.transform = "translate3d(" + x.toFixed(2) + "px,0,0)"; }
    function step() {
      var first = track.querySelector(".slab"); if (!first) return 260;
      return first.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || 28);
    }
    function frame(ts) {
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
      if (tween) {
        var p = Math.min(1, (ts - tween.t0) / tween.dur), e = 1 - Math.pow(1 - p, 3);
        x = tween.from + (tween.to - tween.from) * e;
        if (p >= 1) tween = null;
      } else if (!paused && !hover && !drag) x -= speed * dt;
      wrap(); apply();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    function nudge(dir) { var from = x; tween = { from: from, to: from - dir * step(), t0: performance.now(), dur: 520 }; }
    $("prev").addEventListener("click", function () { nudge(-1); });
    $("next").addEventListener("click", function () { nudge(1); });
    function setPaused(v) {
      paused = v; playBtn.setAttribute("aria-pressed", String(v));
      playBtn.setAttribute("aria-label", v ? "Play the carousel" : "Pause the carousel");
    }
    setPaused(paused);
    playBtn.addEventListener("click", function () { setPaused(!paused); });
    viewport.addEventListener("mouseenter", function () { hover = true; });
    viewport.addEventListener("mouseleave", function () { hover = false; });
    viewport.addEventListener("focusin", function () { hover = true; });
    viewport.addEventListener("focusout", function () { hover = false; });
    viewport.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); nudge(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-1); }
      else if ((e.key === "Enter" || e.key === " ") && e.target.dataset.i) { e.preventDefault(); openSlide(+e.target.dataset.i); }
    });

    // Drag or swipe to scroll; a tap without movement opens the slide
    viewport.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      var s = e.target.closest(".slab");
      drag = { x0: e.clientX, from: x, moved: false, slide: s ? +s.dataset.i : null, id: e.pointerId };
      tween = null;
    });
    viewport.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x0;
      if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; viewport.classList.add("dragging"); try { viewport.setPointerCapture(e.pointerId); } catch (er) {} }
      if (drag.moved) { x = drag.from + dx; wrap(); apply(); }
    });
    function end(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      var d = drag; drag = null; viewport.classList.remove("dragging");
      if (!d.moved && d.slide !== null && e && e.type === "pointerup") openSlide(d.slide);
    }
    viewport.addEventListener("pointerup", end);
    viewport.addEventListener("pointercancel", end);
    viewport.addEventListener("dragstart", function (e) { e.preventDefault(); });
  }

  // ------------------------------------------------------------ lightbox
  function openSlide(i) {
    var s = list[i]; if (!s) return;
    var body, cap;
    if (s.photo) {
      body = '<img src="' + esc(s.photo.src) + '" alt="' + esc(s.photo.title || "") + '">';
      cap = '<b>' + esc(s.photo.title || "") + '</b>' + (s.photo.caption ? '<br>' + esc(s.photo.caption) : '') +
        (s.photo.card ? '<br><a href="' + esc(S.cardURL(s.photo.card)) + '">View in the collection</a>' : '');
    } else {
      var c = s.card;
      body = S.face(c);
      cap = '<b>' + esc(c.name) + ' · ' + esc(c.set) + ' ' + esc(c.num) + '</b><br>' + esc([c.type, S.langName(c.lang), c.grade].filter(Boolean).join(" · ")) +
        '<br><a href="' + esc(S.cardURL(c.id)) + '">View in the collection</a>';
    }
    $("lbBody").innerHTML = body; $("lbCap").innerHTML = cap; $("lb").hidden = false;
  }
  $("lb").addEventListener("click", function (e) { if (!e.target.closest("a")) $("lb").hidden = true; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") $("lb").hidden = true; });

  // ------------------------------------------------------------ progress
  var all = S.cards().filter(function (c) { return c.cat === "set"; });
  var t = S.tally(all);
  var langsUsed = S.LANGS.filter(function (l) { return all.some(function (c) { return c.lang === l.code; }); });
  $("bigPct").textContent = "0%";
  $("progTitle").textContent = t.ob + " of " + t.total + " cards and counting";
  $("bigBar").setAttribute("aria-label", t.ob + " obtained, " + t.tr + " in transit, " + t.un + " unobtained");
  // The bar segments start at zero width and grow when the panel scrolls into view (see reveal below)
  $("bigBar").innerHTML = S.STATUS_ORDER.map(function (s) { return t[s] ? '<span style="flex-grow:0;background:' + COLORS[s] + '" data-n="' + t[s] + '"></span>' : ""; }).join("");
  $("legend").innerHTML = S.STATUS_ORDER.map(function (s) { return '<li><span class="dot" style="background:' + COLORS[s] + '"></span>' + S.STATUS[s] + '<b>' + t[s] + '</b></li>'; }).join("");
  $("tiles").innerHTML = [
    [t.total, "Cards catalogued", "collection.html"],
    [t.ob, "Obtained", "collection.html"],
    [t.tr, "In transit", "collection.html"],
    [t.un, "Still hunting", "collection.html"]
  ].map(function (x, i) { return '<a class="tile" href="' + x[2] + '" data-reveal style="--d:' + (i * 90) + 'ms"><b data-count="' + x[0] + '">0</b><span>' + x[1] + '</span></a>'; }).join("");

  function barHTML(tl) {
    return '<div class="track">' + (tl.total ? S.STATUS_ORDER.map(function (s) { return tl[s] ? '<span style="flex:' + tl[s] + ';background:' + COLORS[s] + '"></span>' : ""; }).join("") : "") + '</div>';
  }
  $("langGrid").innerHTML = langsUsed.map(function (l, i) {
    var lt = S.tally(all.filter(function (c) { return c.lang === l.code; }));
    return '<a class="lrow" data-reveal style="--d:' + ((i % 2) * 90) + 'ms" href="' + esc(S.langURL(l.code)) + '" title="' + esc(l.name + ": " + lt.ob + " of " + lt.total + " obtained") + '"><span class="ln">' + esc(l.name) + '<small>' + esc(l.tab) + '</small></span>' + barHTML(lt) + '<span class="n">' + lt.ob + '/' + lt.total + '</span></a>';
  }).join("");

  // ------------------------------------------------------------ artworks
  var arts = S.artworks();
  $("artTitle").textContent = arts.length + " illustrations of Scizor";
  $("artGrid").innerHTML = arts.map(function (a, i) {
    var group = all.filter(function (c) { return c.art === a.id; });
    var at = S.tally(group);
    var first = group.filter(function (c) { return c.lang === "EN"; })[0] || group[0];
    var sets = {}; group.forEach(function (c) { if (c.set) sets[c.set] = 1; });
    var nSets = Object.keys(sets).length;
    var title = first ? first.set : "Artwork " + (i + 1);
    return '<a class="art" data-reveal style="--d:' + ((i % 4) * 80) + 'ms" href="' + esc(S.artURL(a.id)) + '"><div class="pic" style="background-image:url(\'' + esc(a.img) + '\')"><span class="num">' + String(i + 1).padStart(2, "0") + '</span></div>' +
      '<div class="meta"><h3>' + esc(title) + (nSets > 1 ? ' <span style="color:var(--fg-3);font-weight:500">+' + (nSets - 1) + '</span>' : '') + '</h3><p>' + esc(a.artist || "Unknown artist") + '</p></div>' +
      '<div class="row">' + barHTML(at) + '<small>' + at.ob + '/' + at.total + '</small></div></a>';
  }).join("");

  // ------------------------------------------------------------ scroll reveal
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revealed = {};
  function countUp(el, to, fmt, ms) {
    if (reduceMotion) { el.textContent = fmt(to); return; }
    var t0 = performance.now();
    (function tick(now) {
      var p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(to * e);
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
  // The first time something comes into view, its numbers count up and the progress bar grows
  function firstReveal(el) {
    if (el.id === "progHero" && !revealed.hero) {
      revealed.hero = true;
      setTimeout(function () { Array.prototype.forEach.call($("bigBar").children, function (s) { s.style.flexGrow = s.dataset.n; }); }, reduceMotion ? 0 : 250);
      countUp($("bigPct"), t.pct, function (v) { return (v >= t.pct ? S.pctText(t) : v.toFixed(1) + "%"); }, 1600);
    }
    var b = el.querySelector && el.querySelector("[data-count]");
    if (b && !b._done) { b._done = true; var n = +b.dataset.count; countUp(b, n, function (v) { return String(Math.round(v)); }, 1200); }
  }
  var items = document.querySelectorAll("[data-reveal]");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    Array.prototype.forEach.call(items, function (el) { el.classList.add("in"); firstReveal(el); });
  } else {
    document.body.classList.add("reveal-ready");
    // In when at least 12% is on screen, out again only once it has fully left, so nothing flickers at the edges
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && en.intersectionRatio >= 0.12) { en.target.classList.add("in"); firstReveal(en.target); }
        else if (!en.isIntersecting) en.target.classList.remove("in");
      });
    }, { threshold: [0, 0.12], rootMargin: "0px 0px -4% 0px" });
    // The footer sits behind the page the whole time, so it's handled by scroll position below instead
    Array.prototype.forEach.call(items, function (el) { if (!el.closest(".site-foot")) io.observe(el); });
  }

  // Edge blur fades in after the first bit of scrolling and out near the bottom, so the footer is sharp.
  // The footer's content fades in as the page slides up to uncover it.
  var vTop = document.querySelector(".vignette-top"), vBottom = document.querySelector(".vignette-bottom");
  var foot = document.querySelector(".site-foot"), footInner = foot && foot.querySelector("[data-reveal]");
  if (!reduceMotion && "IntersectionObserver" in window) {
    var onScroll = function () {
      var y = window.scrollY, docH = document.documentElement.scrollHeight, vh = window.innerHeight;
      var left = docH - (y + vh);
      var start = Math.max(0, Math.min(1, (y - 40) / 220));
      var end = Math.max(0, Math.min(1, left / 260));
      if (vTop) vTop.style.opacity = start;
      if (vBottom) vBottom.style.opacity = Math.min(start, end);
      if (footInner) footInner.classList.toggle("in", left < foot.offsetHeight * 0.55);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("load", onScroll); // the browser may restore the scroll position after loading
    onScroll();
  }
})();
