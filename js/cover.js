/* The homepage cover (styles in css/cover.css), in the style of zentry.com's intro.
   The page opens on Scizor red, which turns out to be the logo seen up close: it pulls back to the logo in the
   middle of the screen, which rests there while the homepage loads, with the percentage under it. Then ENTER
   appears. After a little wind-up, the claw opens, chomps twice and opens wide a third time, then rushes
   towards you, into the space between its two halves; the jaw breaks away and the head comes down over you
   until its red fills the screen again, and a window opens in the middle of the red and grows until only the
   homepage is left. The <head> of index.html decides whether to show it (html.cover-on). */
(function () {
  "use strict";
  var root = document.documentElement, cover = document.getElementById("cover");
  window.__coverStarted = true;
  if (!cover) { root.classList.remove("cover-on"); return; }
  if (!root.classList.contains("cover-on")) { cover.remove(); return; }

  var $ = function (id) { return document.getElementById(id); };
  var head = $("coverHead"), jaw = $("coverJaw"), fill = $("coverFill"), count = $("coverCount"), enter = $("coverEnter");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MIN = reduce ? 600 : 2600, MAX = 9000; // the loading takes at least MIN, and never waits longer than MAX
  var RED = 450, APPEAR = 1000, CHOMP = 1200, RUSH = 1250, REVEAL = 1100; // how long each part takes (ms)
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(a, b, v) { v = clamp((v - a) / (b - a), 0, 1); return v * v * (3 - 2 * v); }
  function finish() { root.classList.remove("cover-on"); cover.remove(); window.dispatchEvent(new Event("coverdone")); }

  // ------------------------------------------------------------ the logo, in its own units (see index.html)
  function points(el) { return el.getAttribute("points").trim().split(/\s+/).map(function (p) { return p.split(",").map(Number); }); }
  var HEAD = points(head.querySelector(".logo-head")), EYE = points(head.querySelector(".logo-eye"));
  // The logo's middle and height; the hinge at the back of the claw, which its two halves turn on; and a point in
  // the empty space between them
  var MID = [300, 300], TALL = 319, HINGE = [180, 333], MOUTH = [305, 345];
  // The point of the head furthest from its edges and from the eye (F), and how far that is (FR): zooming in on
  // F far enough fills the whole screen with the head's red
  var F = [0, 0], FR = 0;
  (function () {
    function inside(poly, x, y) {
      for (var i = 0, j = poly.length - 1, c = false; i < poly.length; j = i++) {
        var a = poly[i], b = poly[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
      }
      return c;
    }
    function edge(poly, x, y) {
      var best = Infinity;
      for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        var a = poly[j], b = poly[i], vx = b[0] - a[0], vy = b[1] - a[1];
        var t = clamp(((x - a[0]) * vx + (y - a[1]) * vy) / (vx * vx + vy * vy), 0, 1);
        best = Math.min(best, Math.hypot(a[0] + t * vx - x, a[1] + t * vy - y));
      }
      return best;
    }
    for (var x = 130; x <= 470; x += 2) for (var y = 140; y <= 365; y += 2) {
      if (!inside(HEAD, x, y) || inside(EYE, x, y)) continue;
      var d = Math.min(edge(HEAD, x, y), edge(EYE, x, y));
      if (d > FR) { FR = d; F = [x, y]; }
    }
  })();

  // ------------------------------------------------------------ placing it
  // A placement is a matrix [a b c d e f], from the logo's units to the screen. place(P, s, deg, f): point f
  // of the logo at screen point P, s pixels per unit, turned by deg degrees around f.
  function place(P, s, deg, f) {
    var r = deg * Math.PI / 180, a = s * Math.cos(r), b = s * Math.sin(r);
    return [a, b, -b, a, P[0] - (a * f[0] - b * f[1]), P[1] - (b * f[0] + a * f[1])];
  }
  function then(A, B) { return [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]]; }
  function at(m, p) { return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]; }
  function set(el, m) { el.setAttribute("transform", "matrix(" + m.map(function (v) { return +v.toFixed(3); }).join(" ") + ")"); }

  // The logo rests a little above the middle of the screen, with the percentage (then ENTER) under it
  var vw, vh, base, C;
  function measure() {
    vw = window.innerWidth; vh = window.innerHeight;
    var h = clamp(Math.min(vw * 0.5, vh * 0.34), 120, 300);
    base = h / TALL; C = [vw / 2, vh / 2 - 36];
    count.style.top = enter.style.top = (C[1] + h / 2 + 56) + "px";
  }
  // How many pixels per unit the logo needs, zooming in on F held at screen point P, for the head to cover the screen
  function filling(P) {
    var far = Math.max(Math.hypot(P[0], P[1]), Math.hypot(vw - P[0], P[1]), Math.hypot(P[0], vh - P[1]), Math.hypot(vw - P[0], vh - P[1]));
    return far / FR * 1.08;
  }
  // Resting: breathing gently (t: seconds since it came to rest)
  function resting(t) {
    return place(C, base * (1 + 0.025 * Math.sin(t * 2 * Math.PI / 3.2)), 1.6 * Math.sin(t * 2 * Math.PI / 4.6), MID);
  }
  function both(m) { set(head, m); set(jaw, m); }

  // ------------------------------------------------------------ the three moves (t: 0 to 1)
  // Appearing: pulling back from the head's red, filling the screen, to the logo, unwinding as it goes
  function appear(t) {
    var e = 1 - Math.pow(1 - t, 4), P = at(place(C, base, 0, MID), F), s0 = filling(P);
    both(place(P, Math.exp(Math.log(s0) + (Math.log(base) - Math.log(s0)) * e), 16 * (1 - e), F));
  }
  // Disappearing (ms: time since ENTER; out: where the logo was then, see go()).
  // First the chomping: a little wind-up, then the claw opens, snaps shut twice and opens wide a third time.
  // BITE: how far open the jaw is (degrees) at each moment; the head opens a third as far the other way.
  // SNAPS: when it snaps shut, jolting the whole claw.
  var BITE = [[0, 0], [220, -4], [420, 20], [510, -14], [560, -11], [740, 20], [830, -14], [880, -11], [1120, 30], [CHOMP, 30]], SNAPS = [510, 830];
  function opening(ms) {
    for (var i = 1; i < BITE.length; i++) if (ms <= BITE[i][0]) {
      var a = BITE[i - 1], b = BITE[i], t = (ms - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * (b[1] < a[1] ? t * t * t : 1 - Math.pow(1 - t, 3)); // snapping shut, easing open
    }
    return BITE[BITE.length - 1][1];
  }
  // Then the rush: towards you, into the space between the two halves (MOUTH), the jaw breaking away down to the
  // left, until the head comes down over you (what stays in the same place on screen moves from MOUTH to F) and
  // its red fills the screen
  var out = null;
  function chomp(ms) {
    var m, jawTurn, headTurn, jawAt = HINGE;
    if (ms < CHOMP) {
      var dip = ms < 220 ? 0.06 * Math.sin(Math.PI * ms / 220) : 0, kick = 0;
      SNAPS.forEach(function (s) { if (ms >= s) kick += Math.exp(-(ms - s) / 70); });
      m = place(out.C, out.s * (1 - dip + 0.035 * kick), out.deg + 1.2 * kick, MID);
      jawTurn = opening(ms); headTurn = -jawTurn / 3;
    } else {
      var u = clamp((ms - CHOMP) / RUSH, 0, 1), w = smooth(0.5, 1, u), b = smooth(0.25, 0.75, u);
      if (!out.P) { out.P = at(place(out.C, out.s, out.deg, MID), MOUTH); out.grow = filling(out.P) / out.s; }
      var c = [MOUTH[0] + (F[0] - MOUTH[0]) * w, MOUTH[1] + (F[1] - MOUTH[1]) * w];
      m = place(out.P, out.s * Math.exp(Math.log(out.grow) * Math.pow(u, 1.6)), out.deg - 8 * u * u, c);
      jawTurn = 30 + 45 * b; headTurn = -10 * (1 - w); jawAt = [HINGE[0] - 70 * b, HINGE[1] + 150 * b];
    }
    set(head, then(m, place(HINGE, 1, headTurn, HINGE)));
    set(jaw, then(m, place(jawAt, 1, jawTurn, HINGE)));
  }
  // Then a window opens in the middle of the red, askew at first, and grows out past the edges of the screen
  var SKEW = [[-0.92, -0.55], [0.62, -0.9], [0.95, 0.62], [-0.7, 0.86]], SQUARE = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  function reveal(t) {
    var k = 0.3 * (1 - Math.pow(1 - clamp(t / 0.4, 0, 1), 3)) + 0.8 * Math.pow(clamp((t - 0.28) / 0.72, 0, 1), 3);
    var st = Math.pow(clamp((t - 0.28) / 0.72, 0, 1), 2), r = (-9 + 9 * st) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    var hole = SKEW.map(function (c, i) {
      var x = (c[0] + (SQUARE[i][0] - c[0]) * st) * k * vw / 2, y = (c[1] + (SQUARE[i][1] - c[1]) * st) * k * vh / 2;
      return (vw / 2 + x * cs - y * sn).toFixed(1) + " " + (vh / 2 + x * sn + y * cs).toFixed(1);
    });
    fill.setAttribute("d", "M0 0H" + vw + "V" + vh + "H0Z M" + hole.join("L") + "Z");
  }

  // ------------------------------------------------------------ loading: the fonts and the homepage's images
  var loaded = 0, total = 0, t0 = performance.now();
  function track(el) {
    if (!el || el.complete) return;
    total++;
    var done = function () { loaded++; el.removeEventListener("load", done); el.removeEventListener("error", done); };
    el.addEventListener("load", done); el.addEventListener("error", done);
  }
  Array.prototype.forEach.call(document.images, track);
  if (document.fonts && document.fonts.ready) { total++; document.fonts.ready.then(function () { loaded++; }); }
  function realProgress() { return total ? loaded / total : 1; }

  // ------------------------------------------------------------ the loop
  var phase = "red", since = t0, shown = 0, ready = false;
  measure();
  window.addEventListener("resize", measure);
  if (reduce) cover.classList.add("calm");

  function frame(now) {
    var t;
    if (phase === "done" || phase === "test") return;
    if (phase === "red" && now - t0 >= (reduce ? 0 : RED)) {
      phase = reduce ? "rest" : "appear"; since = now; cover.classList.add("is-logo");
      if (reduce) cover.classList.add("is-resting");
    }
    if (phase === "appear") {
      t = clamp((now - since) / APPEAR, 0, 1); appear(t);
      if (t >= 1) { phase = "rest"; since = now; cover.classList.add("is-resting"); }
    }
    if (phase === "rest") both(reduce ? place(C, base, 0, MID) : resting((now - since) / 1000));
    if (phase === "out") {
      t = Math.min(now - since, CHOMP + RUSH); chomp(t);
      if (t >= CHOMP + RUSH) { phase = "reveal"; since = now; cover.classList.add("is-revealing"); }
    }
    if (phase === "reveal") {
      t = clamp((now - since) / REVEAL, 0, 1); reveal(t);
      if (t >= 1) { finish(); return; }
    }

    // The percentage, then ENTER once everything's in and the logo is resting
    var el = now - t0, goal = el > MAX ? 1 : Math.min(realProgress(), el / MIN);
    shown += (goal - shown) * 0.08; if (goal - shown < 0.003) shown = goal;
    var pct = String(Math.round(shown * 100)); if (count.textContent !== pct) count.textContent = pct;
    if (shown >= 1 && phase === "rest" && !ready) {
      ready = true;
      setTimeout(function () { cover.classList.add("ready"); try { enter.focus({ preventScroll: true }); } catch (e) {} }, 250);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ------------------------------------------------------------ ENTER
  // Start from wherever the breathing had got to
  function from(m) { out = { C: C.slice(), s: Math.hypot(m[0], m[1]), deg: Math.atan2(m[1], m[0]) * 180 / Math.PI }; }
  function go() {
    if (!cover.classList.contains("ready") || phase !== "rest") return;
    cover.classList.add("leaving");
    if (reduce) { phase = "done"; setTimeout(finish, 650); return; }
    from(resting((performance.now() - since) / 1000));
    phase = "out"; since = performance.now();
  }
  enter.addEventListener("click", go);

  // For checking the moves one moment at a time (this stops the cover): ScizorCover.show("appear" | "out" | "reveal", 0 to 1)
  window.ScizorCover = {
    show: function (part, t) {
      phase = "test"; cover.classList.add("is-logo"); cover.classList.toggle("is-revealing", part === "reveal");
      if (part === "out") { from(place(C, base, 0, MID)); chomp(t * (CHOMP + RUSH)); }
      else ({ appear: appear, reveal: reveal })[part](t);
    }
  };
})();
