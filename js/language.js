/* A language's own page (language.html?lang=JA), opened from the Collection page, on the same Pokémon Black and
   White screen as the Collection menu. At the top, a panel with the language's flag, name and neighbours, and its
   card stack and progress. Then every card in that language with search, filters, grid / list / artwork views,
   card details and editing. */
(function () {
  "use strict";
  var S = window.Scizor, DS = window.ScizorDS, esc = S.esc;
  var $ = function (id) { return document.getElementById(id); };

  // Which language this page is for. The tab code works too (?lang=JP); anything else goes back to the circles.
  var want = (new URLSearchParams(location.search).get("lang") || "").toUpperCase();
  var LANG = S.LANGS.filter(function (l) { return l.code === want || l.tab === want; })[0];
  if (!LANG) { location.replace("collection.html"); return; }

  var COLORS = { ob: "var(--obtained)", tr: "var(--transit)", un: "var(--unobtained)" };
  var CYCLE = { un: "tr", tr: "ob", ob: "un" };
  var SORTS = [
    ["order", "Sheet order"], ["set", "Set name (A-Z)"], ["num", "Card number"], ["status", "Status"],
    ["datedesc", "Newest release"], ["dateasc", "Oldest release"], ["recent", "Recently updated"],
    ["pricedesc", "Price: high to low"], ["priceasc", "Price: low to high"]
  ];
  var PRICE_SORT = { pricedesc: 1, priceasc: 1 };
  // Master Set and Cameos. Other collectibles (plush, figures...) don't belong to a language, so they aren't listed
  // here. The page shows the Master Set; a link with #cat=cameo shows the cameos.
  var CATS = S.CATS.filter(function (k) { return k.kind === "cards"; });
  S.initChrome();
  DS.clock($("dsmClock"));
  // The menu font has no "·" or brackets: square dots go between the parts of a line, and a name with brackets
  // is said another way
  var DOT = '<i class="dsm-dot"></i>', NAMES = { LA: "Latin American Spanish" };
  function langName(l) { return NAMES[l.code] || l.name; }

  var state = { cat: "set", art: "all", status: "all", q: "", sort: "order", view: "grid" };
  var editing = false, reorder = false, openId = null, openList = [];
  var all = [];

  function load() { all = S.cards(); }
  function catDef() { return CATS.filter(function (c) { return c.id === state.cat; })[0] || CATS[0]; }
  function inCat() { return all.filter(function (c) { return c.cat === state.cat && c.lang === LANG.code; }); }
  function byId(id) { return all.filter(function (c) { return c.id === id; })[0] || null; }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function stored(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  // ------------------------------------------------------------ url hash <-> filters
  function readHash() {
    var o = {};
    location.hash.replace(/^#/, "").split("&").forEach(function (kv) {
      var i = kv.indexOf("="); if (i > 0) o[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
    });
    return o;
  }
  function applyHash() {
    var h = readHash();
    state.cat = CATS.some(function (c) { return c.id === h.cat; }) ? h.cat : "set";
    state.art = h.art || "all"; state.status = h.status || "all"; state.q = h.q || "";
    if (h.card) { var c = byId(h.card); if (c) state.cat = c.cat; }
    return h;
  }
  function writeHash() {
    var p = [];
    if (state.cat !== "set") p.push("cat=" + state.cat);
    if (state.art !== "all") p.push("art=" + state.art);
    if (state.status !== "all") p.push("status=" + state.status);
    if (state.q) p.push("q=" + encodeURIComponent(state.q));
    if (openId) p.push("card=" + encodeURIComponent(openId));
    try { history.replaceState(null, "", location.pathname + location.search + (p.length ? "#" + p.join("&") : "")); } catch (e) {}
  }

  // ------------------------------------------------------------ filtering + sorting
  function textMatch(hay) {
    if (!state.q) return true;
    hay = hay.toLowerCase();
    return state.q.toLowerCase().split(/\s+/).filter(Boolean).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function matches(c) {
    if (state.art !== "all" && c.art !== state.art) return false;
    if (state.status !== "all" && c.status !== state.status) return false;
    return textMatch([c.name, c.set, c.native, c.num, c.type, c.artist, c.code, c.note, c.grade].join(" "));
  }
  function numKey(n) { var m = /(\d+)/.exec(n || ""); return m ? parseInt(m[1], 10) : 1e9; }
  function priceOf(c) { return c.price === "" || c.price == null || isNaN(Number(c.price)) ? null : Number(c.price); }
  function applySort(list) {
    var s = state.sort; if (s === "order") return list;
    var si = { ob: 0, tr: 1, un: 2 };
    var nullLast = function (a, b, dir) { if (a === null && b === null) return 0; if (a === null) return 1; if (b === null) return -1; return (a - b) * dir; };
    var cmp = {
      set: function (a, b) { return (a.set || "").localeCompare(b.set || "") || numKey(a.num) - numKey(b.num); },
      num: function (a, b) { return numKey(a.num) - numKey(b.num) || (a.set || "").localeCompare(b.set || ""); },
      status: function (a, b) { return si[a.status] - si[b.status]; },
      pricedesc: function (a, b) { return nullLast(priceOf(a), priceOf(b), -1); },
      priceasc: function (a, b) { return nullLast(priceOf(a), priceOf(b), 1); },
      datedesc: function (a, b) { return nullLast(a.date ? Date.parse(a.date) : null, b.date ? Date.parse(b.date) : null, -1); },
      dateasc: function (a, b) { return nullLast(a.date ? Date.parse(a.date) : null, b.date ? Date.parse(b.date) : null, 1); },
      recent: function (a, b) { return S.touched(b.id) - S.touched(a.id); }
    }[s];
    if (!cmp) return list;
    return list.map(function (c, i) { return [c, i]; }).sort(function (a, b) { return cmp(a[0], b[0]) || a[1] - b[1]; }).map(function (x) { return x[0]; });
  }
  function visible() { return applySort(inCat().filter(matches)); }

  // ------------------------------------------------------------ the language's flag, name and neighbours
  var ORDER = S.collectionLangs();
  var di = -1; ORDER.forEach(function (l, i) { if (l.code === LANG.code) di = i; });
  function pad(n) { return String(n).padStart(2, "0"); }
  // A little pixel arrow for the neighbours (pointing left; the next one is flipped)
  var ARROW = '<svg viewBox="0 0 4 7" shape-rendering="crispEdges" aria-hidden="true"><path d="M3 0h1v7H3zM2 1h1v5H2zM1 2h1v3H1zM0 3h1v1H0z"/></svg>';
  function renderIntro() {
    document.title = LANG.name + " · xscizorr";
    // The flag (data/flags.js), the name, and where it comes in the Collection page's order
    $("lpFlag").innerHTML = (window.SCIZOR_FLAGS || {})[LANG.code] || "";
    $("lpName").textContent = langName(LANG);
    $("lpIndex").innerHTML = (di >= 0 ? pad(di + 1) + "/" + pad(ORDER.length) + DOT : "") + esc(LANG.tab);
    // The ✕ goes back to the languages, landing on this one (the menu's Collection link does the same)
    var back = "collection.html#" + LANG.code;
    $("lpBack").href = back;
    Array.prototype.forEach.call(document.querySelectorAll('.menu-links a[href="collection.html"]'), function (a) { a.href = back; });
    // Between them, the entire checklist (checklist.html), with its clipboard from the menu
    $("lpAllIcon").innerHTML = DS.pixels("list");
    // The languages either side, in the same order as on the Collection page (the ends wrap round)
    if (di < 0) { $("lpPrev").hidden = $("lpNext").hidden = true; return; }
    [["lpPrev", di - 1, "Previous"], ["lpNext", di + 1, "Next"]].forEach(function (p) {
      var d = ORDER[(p[1] + ORDER.length) % ORDER.length], name = langName(d);
      $(p[0]).href = S.langURL(d.code);
      $(p[0]).innerHTML = p[2] === "Previous" ? ARROW + "<span>" + esc(name) + "</span>" : "<span>" + esc(name) + "</span>" + ARROW;
      $(p[0]).setAttribute("aria-label", p[2] + " language: " + d.name);
    });
  }

  // ------------------------------------------------------------ progress
  function barTrack(t) {
    return '<div class="track">' + (t.total ? S.STATUS_ORDER.map(function (s) { return t[s] ? '<span style="flex:' + t[s] + ';background:' + COLORS[s] + '"></span>' : ""; }).join("") : "") + '</div>';
  }
  // The language's cards as an isometric stack. Each layer's height is its share of the total (the side-on
  // view keeps heights true): what you own at the bottom, what's on the way, then a pale outline for the rest.
  // Clicking a layer filters by that status, like the buttons underneath.
  var stackAnimated = false;
  function drawStack(t) {
    var H = 190, s = 1.0, O = [118, 214];
    var X = [63 * s * Math.cos(Math.PI / 6), 63 * s * .5], Y = [-88 * s * Math.cos(Math.PI / 6), 88 * s * .5];
    var A = [0, 0], B = X, C = [X[0] + Y[0], X[1] + Y[1]], D = Y;
    function P(p, z) { return [O[0] + p[0], O[1] + p[1] - z]; }
    function pt(p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }
    function poly(ps) { return ps.map(pt).join(" "); }
    var animate = !stackAnimated && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    stackAnimated = true;
    var layers = t.total ? S.STATUS_ORDER.map(function (k) { return [k, t[k]]; }).filter(function (l) { return l[1] > 0; }) : [["un", 0]];
    var z = 0, blocks = "", labels = [], i = 0;
    layers.forEach(function (l) {
      var k = l[0], h = t.total ? H * l[1] / t.total : H, z0 = z, z1 = z + h; z = z1;
      var ghost = k === "un", col = "var(--s-" + k + ")";
      var fills = ghost ? ["var(--s-un-top)", "var(--s-un)", "var(--s-un-side)"]
        : ["color-mix(in srgb, " + col + " 72%, #fff)", col, "color-mix(in srgb, " + col + " 74%, #000)"];
      var stroke = ghost ? ' stroke="var(--s-un-edge)" stroke-width=".8"' : ' stroke="rgba(0,0,0,.08)" stroke-width=".5"';
      var edges = "";
      for (var zz = z0 + 3; zz < z1 - 1; zz += 3) {
        edges += '<polyline points="' + poly([P(D, zz), P(C, zz), P(B, zz)]) + '" fill="none" stroke="' + (ghost ? "var(--s-un-edge)" : "#fff") + '" stroke-opacity="' + (ghost ? ".6" : ".16") + '" stroke-width=".6"/>';
      }
      var dim = state.status !== "all" && state.status !== k ? " is-dim" : "";
      var on = state.status === k ? " is-on" : "";
      var name = t.total ? S.STATUS[k] + ": " + l[1] + " of " + t.total + " (" + (l[1] / t.total * 100).toFixed(1) + "%)" : "Nothing here yet";
      blocks += '<g class="stack-block' + dim + on + (animate ? " rise" : "") + '" style="animation-delay:' + (i * .22) + 's"' +
        (t.total ? ' data-s="' + k + '" role="button" tabindex="0" aria-pressed="' + (state.status === k) + '" aria-label="' + esc(name + ". Click to show only these.") + '"' : '') + '>' +
        '<title>' + esc(name) + '</title>' +
        '<polygon points="' + poly([P(D, z0), P(C, z0), P(C, z1), P(D, z1)]) + '" fill="' + fills[1] + '"' + stroke + '/>' +
        '<polygon points="' + poly([P(B, z0), P(C, z0), P(C, z1), P(B, z1)]) + '" fill="' + fills[2] + '"' + stroke + '/>' + edges +
        '<polygon points="' + poly([P(A, z1), P(B, z1), P(C, z1), P(D, z1)]) + '" fill="' + fills[0] + '"' + stroke + '/></g>';
      labels.push({ k: k, n: l[1], y: P(B, (z0 + z1) / 2)[1], x: P(B, (z0 + z1) / 2)[0], delay: .35 + i * .22 });
      i++;
    });
    // Keep labels at least 30px apart so thin layers don't overlap
    for (var j = 1; j < labels.length; j++) if (labels[j].y > labels[j - 1].y - 30) labels[j].y = labels[j - 1].y - 30;
    var lx = 222, lhtml = labels.map(function (l) {
      var lineY = Math.min(Math.max(l.y, 10), 300);
      var txt = t.total ? S.STATUS[l.k] + " · " + (l.n / t.total * 100).toFixed(1) + "%" : "Nothing here yet";
      return '<g class="' + (animate ? "rise" : "") + '" style="animation-delay:' + l.delay + 's" aria-hidden="true">' +
        '<polyline points="' + (l.x + 4).toFixed(1) + ',' + l.y.toFixed(1) + ' ' + (lx - 8) + ',' + lineY.toFixed(1) + '" fill="none" stroke="var(--line-2)" stroke-width="1"/>' +
        (t.total ? '<text class="stack-num" x="' + lx + '" y="' + (lineY + 2).toFixed(1) + '">' + l.n + '</text>' : '') +
        '<text class="stack-txt" x="' + lx + '" y="' + (lineY + (t.total ? 16 : 4)).toFixed(1) + '">' + esc(txt) + '</text></g>';
    }).join("");
    var floor = '<ellipse cx="' + (O[0] - 12) + '" cy="' + (O[1] + 48) + '" rx="92" ry="15" fill="#1e1c18" opacity=".14" filter="url(#stack-floor)"/>';
    $("stack").innerHTML = '<svg viewBox="0 0 360 300" role="group" aria-label="' + esc(t.ob + " obtained, " + t.tr + " in transit, " + t.un + " unobtained, out of " + t.total) + '">' +
      '<defs><filter id="stack-floor" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter></defs>' +
      floor + blocks + lhtml + '</svg>';
  }
  function summary(t) {
    if (!t.total) return editing ? "Nothing here yet. Use “Add card” to start the list." : "Nothing here yet.";
    if (t.ob === t.total) return (t.total === 1 ? "The only card is" : "All " + t.total + " cards") + " obtained. Complete!";
    return t.ob + " of " + t.total + (t.total === 1 ? " card" : " cards") + " obtained" + (t.tr ? ", " + t.tr + " on the way" : "") + " and " + t.un + " still to find.";
  }
  function renderHero() {
    $("title").textContent = catDef().title;
    var scope = inCat(), t = S.tally(scope);
    $("sub").textContent = summary(t);
    drawStack(t);
    $("pct").textContent = S.pctText(t);
    $("cost").textContent = t.value ? S.money(t.value) + " spent" : "";
    $("stats").innerHTML = S.STATUS_ORDER.map(function (s) {
      return '<button type="button" class="stat s-' + s + '" data-s="' + s + '" aria-pressed="' + (state.status === s) + '" title="Show only ' + S.STATUS[s].toLowerCase() + '"><b>' + t[s] + '</b><span>' + S.STATUS[s] + '</span></button>';
    }).join("");
  }

  // ------------------------------------------------------------ toolbar
  function langArts() { var scope = inCat(); return S.artworks().filter(function (a) { return scope.some(function (c) { return c.art === a.id; }); }); }
  function artLabel(a) {
    var i = S.artworks().indexOf(a);
    var first = all.filter(function (c) { return c.art === a.id && c.lang === LANG.code; })[0] || all.filter(function (c) { return c.art === a.id; })[0];
    return pad(i + 1) + " · " + (first ? first.set : "Artwork") + (a.artist ? " (" + a.artist + ")" : "");
  }
  function renderToolbar() {
    $("q").value = state.q;
    $("statusSel").value = state.status;
    var arts = langArts();
    if (state.art !== "all" && !arts.some(function (a) { return a.id === state.art; })) state.art = "all";
    $("artSel").innerHTML = '<option value="all">All artworks</option>' + arts.map(function (a) { return '<option value="' + a.id + '">' + esc(artLabel(a)) + '</option>'; }).join("");
    $("artSel").value = state.art;
    if (PRICE_SORT[state.sort] && !editing) state.sort = "order";
    $("sortSel").innerHTML = SORTS.filter(function (s) { return editing || !PRICE_SORT[s[0]]; }).map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join("");
    $("sortSel").value = state.sort;
    Array.prototype.forEach.call(document.querySelectorAll(".viewtog button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.view === state.view)); });
  }

  // ------------------------------------------------------------ grid
  function logoHTML(c) { return '<span class="logo" title="' + esc(c.set || "") + '">' + (c.sym ? '<img src="' + esc(c.sym) + '" alt="" loading="lazy">' : esc(S.langTab(c.lang))) + '</span>'; }
  function cardHTML(c) {
    return '<article class="card' + (c.status === "un" ? " is-un" : "") + '" data-id="' + esc(c.id) + '" tabindex="0" aria-label="' + esc(c.name + ", " + (c.set || "") + " " + (c.num || "") + ", " + S.STATUS[c.status]) + '">' +
      '<div class="c-art">' + S.face(c, { dim: true, thumb: true }) + S.pill(c.status, editing ? "button" : "span") + (c.status === "ob" ? S.gradeBadge(c.grade) : "") + '</div>' +
      '<div class="c-body"><div class="c-head">' + logoHTML(c) + '<div><h3>' + esc(c.name) + '</h3><p>' + esc(c.set || "-") + (c.native ? '<em>' + esc(c.native) + '</em>' : '') + '</p></div></div>' +
      '<dl><div><dt>Number</dt><dd>' + esc(c.num || "-") + '</dd></div><div><dt>Grade</dt><dd>' + esc(c.status === "ob" && c.grade ? c.grade : "-") + '</dd></div>' +
      '<div class="wide"><dt>Card type</dt><dd>' + esc(c.type || "-") + '</dd></div>' +
      '<div class="rx"><dt>Artist</dt><dd>' + esc(c.artist || "-") + '</dd></div>' +
      '<div class="rx"><dt>Released</dt><dd>' + esc(S.fmtDate(c.date)) + '</dd></div>' +
      '<div class="rx px"><dt>Price</dt><dd>' + S.money(c.price) + '</dd></div></dl>' +
      '<div class="actions edit-only"><button type="button" data-act="edit">Edit</button><button type="button" data-act="del">Delete</button></div></div></article>';
  }
  function emptyHTML() {
    var filtered = state.q || state.status !== "all" || state.art !== "all";
    if (filtered) return '<div class="none"><b>No matches</b>Try clearing the search or filters. <button type="button" class="btn ghost sm" data-clear="all" style="margin-left:8px">Clear filters</button></div>';
    return '<div class="none"><b>Nothing here yet</b>' + (editing ? 'Use “Add card” to start this list.' : 'Switch on Edit mode to add to this list.') + '</div>';
  }
  function renderGroups(list) {
    var by = {}; list.forEach(function (c) { var k = c.art || "_"; (by[k] = by[k] || []).push(c); });
    var scope = inCat();
    var html = S.artworks().map(function (a, i) {
      var g = by[a.id]; if (!g) return "";
      var gt = S.tally(scope.filter(function (c) { return c.art === a.id; }));
      var sets = {}; g.forEach(function (c) { if (c.set) sets[c.set] = 1; });
      var more = Object.keys(sets).length - 1;
      return '<section class="group"><div class="ghead"><button type="button" class="gpic" data-zoomart="' + a.id + '" style="background-image:url(\'' + esc(a.img) + '\')" aria-label="Enlarge artwork"></button>' +
        '<div class="gmeta"><small>Artwork ' + pad(i + 1) + '</small><h3>' + esc(g[0].set) + (more > 0 ? ' <span style="color:var(--fg-3);font-weight:500">+' + more + ' more</span>' : '') + '</h3>' +
        '<p>' + esc(a.artist || "Unknown artist") + ' · ' + g.length + ' shown</p><div class="gprog">' + barTrack(gt) + '<span>' + gt.ob + '/' + gt.total + '</span></div></div></div>' +
        '<div class="ggrid">' + g.map(cardHTML).join("") + '</div></section>';
    }).join("");
    if (by._) html += '<section class="group"><div class="ghead"><div class="gmeta"><small>No artwork set</small><h3>Other cards</h3></div></div><div class="ggrid">' + by._.map(cardHTML).join("") + '</div></section>';
    return html;
  }
  function renderGrid() {
    var list = visible(), g = $("grid");
    g.classList.toggle("rows", state.view === "rows");
    g.classList.toggle("groups", state.view === "art");
    $("count").textContent = list.length + " shown";
    if (!list.length) g.innerHTML = emptyHTML();
    else if (state.view === "art") g.innerHTML = renderGroups(list);
    else g.innerHTML = list.map(cardHTML).join("");
    applyReorder();
  }
  function renderAll() { renderHero(); renderToolbar(); renderGrid(); writeHash(); }
  function refresh() { load(); renderAll(); if (openId && !$("ovDetail").hidden) { if (byId(openId)) showDetail(openId); else closeOv("ovDetail"); } }
  function toCards() { window.scrollTo({ top: $("toolbar").getBoundingClientRect().top + window.scrollY - 84, behavior: "smooth" }); }

  // ------------------------------------------------------------ overlays
  var lastFocus = null;
  function openOv(id) {
    lastFocus = document.activeElement;
    $(id).hidden = false;
    var f = $(id).querySelector("input:not([type=file]), select, textarea, button:not(.xbtn)") || $(id).querySelector("button");
    if (f) setTimeout(function () { f.focus(); }, 30);
  }
  function closeOv(id) {
    $(id).hidden = true;
    if (id === "ovDetail") { openId = null; writeHash(); }
    if (lastFocus && document.body.contains(lastFocus)) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }
  Array.prototype.forEach.call(document.querySelectorAll(".overlay"), function (ov) {
    ov.addEventListener("mousedown", function (e) { ov._down = e.target === ov; });
    ov.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]") || (e.target === ov && ov._down) || ov.id === "lb") closeOv(ov.id);
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      var order = ["lb", "ovConfirm", "ovGithub", "ovCard", "ovData", "ovDetail"];
      for (var i = 0; i < order.length; i++) if (!$(order[i]).hidden) { closeOv(order[i]); return; }
    }
    if (!$("ovDetail").hidden && $("ovCard").hidden && $("ovConfirm").hidden && $("lb").hidden) {
      if (e.key === "ArrowLeft") stepDetail(-1);
      else if (e.key === "ArrowRight") stepDetail(1);
    }
  });
  function confirmBox(title, msg, yes) {
    $("cfTitle").textContent = title; $("cfMsg").textContent = msg; $("cfYes").textContent = yes || "Delete";
    openOv("ovConfirm");
    return new Promise(function (res) {
      var done = function (v) { $("cfYes").onclick = $("cfNo").onclick = null; closeOv("ovConfirm"); res(v); };
      $("cfYes").onclick = function () { done(true); };
      $("cfNo").onclick = function () { done(false); };
    });
  }
  function lightbox(html, cap) { $("lbBody").innerHTML = html; $("lbCap").innerHTML = cap || ""; openOv("lb"); }

  // ------------------------------------------------------------ detail
  function showDetail(id) {
    var c = byId(id); if (!c) return;
    openId = id;
    if (!openList.length || openList.indexOf(id) < 0) openList = visible().map(function (x) { return x.id; });
    var pos = openList.indexOf(id);
    $("detPos").textContent = pos >= 0 ? (pos + 1) + " of " + openList.length : "";
    $("detPrev").disabled = pos <= 0; $("detNext").disabled = pos < 0 || pos >= openList.length - 1;
    var a = S.artwork(c.art);
    var prints = c.art ? all.filter(function (x) { return x.art === c.art && x.cat === c.cat && x.lang === LANG.code; }).length : 0;
    $("detImg").innerHTML = hasBack(c) ? flipHTML(c) : S.face(c);
    $("detBody").innerHTML = '<div class="dethead">' + logoHTML(c) + '<div><h2 id="detTitle">' + esc(c.name) + '</h2><p>' + esc(c.set || "-") + (c.native ? '<em>' + esc(c.native) + '</em>' : '') + '</p></div></div>' +
      '<div class="badges">' + S.pill(c.status) + (c.status === "ob" ? S.gradeBadge(c.grade) : "") + '</div>' +
      '<dl><div><dt>Number</dt><dd>' + esc(c.num || "-") + '</dd></div><div><dt>Language</dt><dd>' + esc(S.langName(c.lang)) + '</dd></div>' +
      '<div><dt>Card type</dt><dd>' + esc(c.type || "-") + '</dd></div><div><dt>Grade</dt><dd>' + esc(c.status === "ob" && c.grade ? c.grade : "-") + '</dd></div>' +
      '<div><dt>Artist</dt><dd>' + esc(c.artist || "-") + '</dd></div><div><dt>Release date</dt><dd>' + esc(S.fmtDate(c.date)) + '</dd></div>' +
      (c.code ? '<div><dt>Set code</dt><dd>' + esc(c.code) + '</dd></div>' : '') +
      (editing ? '<div><dt>Price paid</dt><dd>' + S.money(c.price) + '</dd></div>' : '') +
      (a ? '<div><dt>Artwork</dt><dd>' + (prints > 1 ? '<button type="button" class="linkish" data-art="' + a.id + '">See all ' + prints + ' ' + esc(LANG.name) + ' prints</button>' : 'Its only ' + esc(LANG.name) + ' print') + '</dd></div>' : '') + '</dl>' +
      (c.note ? '<div class="detnote"><dt>Notes</dt><p>' + esc(c.note) + '</p></div>' : '') +
      statusButtons(c) + '<div class="det-actions edit-only"><button type="button" class="btn red sm" data-dact="edit">Edit card</button><button type="button" class="btn ghost sm" data-dact="del">Delete</button></div>';
    if ($("ovDetail").hidden) openOv("ovDetail");
    writeHash();
  }
  // Front/back flip, only for cards whose slab has a back scan (and no photo uploaded over it)
  function hasBack(c) { return !!c.back && S.photoFor(c) === c.img; }
  function flipHTML(c) {
    return '<div class="flip" id="flip"><div class="flip-inner">' +
      '<div class="flip-face">' + S.face(c) + '</div>' +
      '<div class="flip-face flip-back"><div class="face photo"><img src="' + esc(c.back) + '" alt="Back of the slab"></div></div>' +
      '</div></div>' +
      '<button type="button" class="btn ghost sm flipbtn" data-flip aria-pressed="false">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15"/><path d="M4 20v-5h5"/></svg>' +
      '<span>Show back</span></button>';
  }
  function statusButtons(c) {
    return '<div class="det-actions edit-only" role="group" aria-label="Set status">' + S.STATUS_ORDER.map(function (s) {
      return '<button type="button" class="btn sm ' + (c.status === s ? "" : "ghost") + '" data-setstatus="' + s + '" aria-pressed="' + (c.status === s) + '">' + S.STATUS[s] + '</button>';
    }).join("") + '</div>';
  }
  function openDetail(id) { openList = visible().map(function (x) { return x.id; }); showDetail(id); }
  function stepDetail(d) { var i = openList.indexOf(openId) + d; if (i >= 0 && i < openList.length) showDetail(openList[i]); }
  $("detPrev").addEventListener("click", function () { stepDetail(-1); });
  $("detNext").addEventListener("click", function () { stepDetail(1); });
  $("detImg").addEventListener("click", function (e) {
    var c = byId(openId); if (!c) return;
    var fb = e.target.closest("[data-flip]");
    if (fb) {
      var back = $("flip").classList.toggle("is-back");
      fb.setAttribute("aria-pressed", String(back));
      fb.querySelector("span").textContent = back ? "Show front" : "Show back";
      return;
    }
    var flipped = $("flip") && $("flip").classList.contains("is-back");
    var ph = flipped ? c.back : S.photoFor(c);
    lightbox(ph ? '<img src="' + esc(ph) + '" alt="">' : $("detImg").innerHTML, esc(c.name) + (c.set ? " · " + esc(c.set) + " " + esc(c.num || "") : ""));
  });
  $("detBody").addEventListener("click", function (e) {
    var c = byId(openId); if (!c) return;
    var art = e.target.closest("[data-art]");
    if (art) { closeOv("ovDetail"); state.art = art.dataset.art; state.view = state.view === "rows" ? "rows" : "grid"; renderAll(); toCards(); return; }
    var st = e.target.closest("[data-setstatus]");
    if (st) { setStatus(c, st.dataset.setstatus); return; }
    var act = e.target.closest("[data-dact]"); if (!act) return;
    if (act.dataset.dact === "edit") openCardForm(c);
    else if (act.dataset.dact === "del") askDelete(c);
  });

  // ------------------------------------------------------------ edits
  function setStatus(c, s) { S.updateCard(c.id, { status: s }); refresh(); }
  function askDelete(c) {
    confirmBox("Delete this card?", (c.name || "This entry") + (c.set ? " · " + c.set + " " + (c.num || "") : "") + " will be removed from the list.", "Delete").then(function (ok) {
      if (!ok) return;
      S.deleteCard(c.id);
      if (openId === c.id) closeOv("ovDetail");
      refresh(); S.toast("Deleted");
    });
  }

  // card form
  var formId = null, pendingPhoto;
  function fillSelect(el, opts, val) { el.innerHTML = opts.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join(""); el.value = val; }
  function openCardForm(c) {
    formId = c ? c.id : null; pendingPhoto = undefined;
    $("cardFormTitle").textContent = c ? "Edit card" : "Add card";
    fillSelect($("f-lang"), S.LANGS.map(function (l) { return [l.code, l.name]; }), c ? c.lang : LANG.code);
    fillSelect($("f-cat"), CATS.map(function (k) { return [k.id, k.name]; }), c ? c.cat : state.cat);
    fillSelect($("f-art"), [["", "None"]].concat(S.artworks().map(function (a) { return [a.id, artLabel(a)]; })), c ? (c.art || "") : (state.art !== "all" ? state.art : ""));
    var sets = {}, types = {}; all.forEach(function (x) { if (x.set) sets[x.set] = 1; if (x.type) types[x.type] = 1; });
    $("setList").innerHTML = Object.keys(sets).sort().map(function (s) { return '<option value="' + esc(s) + '">'; }).join("");
    $("typeList").innerHTML = Object.keys(types).sort().map(function (s) { return '<option value="' + esc(s) + '">'; }).join("");
    var v = c || {};
    $("f-name").value = v.name || (c ? "" : "Scizor"); $("f-set").value = v.set || ""; $("f-native").value = v.native || "";
    $("f-num").value = v.num || ""; $("f-type").value = v.type || ""; $("f-status").value = v.status || "un"; $("f-grade").value = v.grade || "";
    $("f-artist").value = v.artist || ""; $("f-date").value = v.date || ""; $("f-price").value = v.price || ""; $("f-code").value = v.code || "";
    $("f-note").value = v.note || ""; $("f-img").value = "";
    showThumb(c ? S.photoFor(c) : "");
    openOv("ovCard");
  }
  function showThumb(src) {
    $("f-photoRow").hidden = !src;
    $("f-thumb").style.backgroundImage = src ? "url('" + src.replace(/'/g, "%27") + "')" : "";
  }
  $("f-art").addEventListener("change", function () {
    var a = S.artwork($("f-art").value); if (a && !$("f-artist").value) $("f-artist").value = a.artist || "";
  });
  $("f-img").addEventListener("change", function () {
    var f = $("f-img").files[0]; if (!f) return;
    S.resizeImage(f).then(function (url) { pendingPhoto = url; showThumb(url); }).catch(function () { S.toast("That file couldn't be read as an image."); });
  });
  $("f-rmPhoto").addEventListener("click", function () { pendingPhoto = null; $("f-img").value = ""; showThumb(""); });
  $("cardForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var set = $("f-set").value.trim();
    var old = formId ? byId(formId) : null;
    var sym = old && old.set === set ? old.sym || "" : ((all.filter(function (x) { return x.set === set && x.sym; })[0] || {}).sym || "");
    var fields = {
      name: $("f-name").value.trim(), lang: $("f-lang").value, cat: $("f-cat").value, set: set, native: $("f-native").value.trim(),
      num: $("f-num").value.trim(), type: $("f-type").value.trim(), status: $("f-status").value, grade: $("f-grade").value.trim(),
      art: $("f-art").value, artist: $("f-artist").value.trim(), date: $("f-date").value, price: $("f-price").value,
      code: $("f-code").value.trim(), note: $("f-note").value.trim(), sym: sym
    };
    var id = formId;
    if (pendingPhoto === null) fields.img = "none";
    if (id) S.updateCard(id, fields); else id = S.addCard(fields).id;
    var p = pendingPhoto === undefined ? Promise.resolve() : pendingPhoto === null ? Promise.resolve(S.removeImage(id)) : S.setImage(id, pendingPhoto);
    p.then(function () {
      closeOv("ovCard");
      if (fields.lang !== LANG.code) {
        // It belongs on another language's page now
        if (openId === id) closeOv("ovDetail");
        refresh(); S.toast((formId ? "Card moved to " : "Card added to ") + S.langName(fields.lang));
        return;
      }
      if (fields.cat !== state.cat) state.cat = fields.cat;
      refresh(); S.toast(formId ? "Card updated" : "Card added");
      if (!formId) gotoCard(id);
    });
  });

  // ------------------------------------------------------------ reorder (drag and drop)
  var dragEl = null;
  function applyReorder() {
    var g = $("grid");
    g.classList.toggle("reorder", reorder);
    Array.prototype.forEach.call(g.querySelectorAll(".card"), function (c) { c.draggable = reorder; });
    if (reorder) $("count").textContent = "Drag cards to reorder";
  }
  function toggleReorder(v) {
    if (v && (state.view === "art" || state.sort !== "order")) { S.toast("Switch to Sheet order and grid or list view to reorder."); return; }
    reorder = v; $("reorderBtn").setAttribute("aria-pressed", String(v)); $("reorderBtn").textContent = v ? "Done" : "Reorder";
    renderGrid();
  }
  $("reorderBtn").addEventListener("click", function () { toggleReorder(!reorder); });
  $("grid").addEventListener("dragstart", function (e) {
    var c = e.target.closest && e.target.closest(".card");
    if (!reorder || !c) { e.preventDefault(); return; }
    dragEl = c; c.classList.add("dragging");
    try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", c.dataset.id); } catch (x) {}
  });
  $("grid").addEventListener("dragover", function (e) {
    if (!dragEl) return; e.preventDefault();
    var t = e.target.closest(".card"); if (!t || t === dragEl) return;
    var r = t.getBoundingClientRect(), rows = $("grid").classList.contains("rows");
    var before = rows ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2;
    t.parentNode.insertBefore(dragEl, before ? t : t.nextSibling);
  });
  $("grid").addEventListener("drop", function (e) { if (dragEl) e.preventDefault(); });
  $("grid").addEventListener("dragend", function () {
    if (!dragEl) return;
    dragEl.classList.remove("dragging"); dragEl = null;
    // Put the visible cards back into the slots they occupied in the full list, in their new order
    var ids = Array.prototype.map.call($("grid").querySelectorAll(".card"), function (c) { return c.dataset.id; });
    var master = all.map(function (c) { return c.id; }), slots = [];
    master.forEach(function (id, k) { if (ids.indexOf(id) >= 0) slots.push(k); });
    ids.forEach(function (id, k) { master[slots[k]] = id; });
    S.setOrder(master);
    load(); renderHero();
  });

  // ------------------------------------------------------------ events
  function statusClick(e) {
    var b = e.target.closest("[data-s]"); if (!b) return;
    state.status = state.status === b.dataset.s ? "all" : b.dataset.s;
    renderHero(); renderToolbar(); renderGrid(); writeHash();
  }
  $("stats").addEventListener("click", statusClick);
  $("stack").addEventListener("click", statusClick);
  $("stack").addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var b = e.target.closest("[data-s]"); if (!b) return;
    e.preventDefault();
    var k = b.dataset.s;
    statusClick(e);
    var again = $("stack").querySelector('[data-s="' + k + '"]'); if (again) again.focus(); // the stack was redrawn
  });
  var qTimer;
  $("q").addEventListener("input", function () { clearTimeout(qTimer); qTimer = setTimeout(function () { state.q = $("q").value.trim(); renderGrid(); writeHash(); }, 120); });
  $("statusSel").addEventListener("change", function () { state.status = $("statusSel").value; renderHero(); renderGrid(); writeHash(); });
  $("artSel").addEventListener("change", function () { state.art = $("artSel").value; renderHero(); renderGrid(); writeHash(); });
  $("sortSel").addEventListener("change", function () { state.sort = $("sortSel").value; if (reorder && state.sort !== "order") toggleReorder(false); renderGrid(); });
  document.querySelector(".viewtog").addEventListener("click", function (e) {
    var b = e.target.closest("[data-view]"); if (!b) return;
    state.view = b.dataset.view; store("xscizorr-view", state.view);
    if (reorder && state.view === "art") toggleReorder(false);
    renderToolbar(); renderGrid();
  });
  $("grid").addEventListener("click", function (e) {
    if (reorder) return;
    if (e.target.closest("[data-clear]")) { clearFilters(); return; }
    var z = e.target.closest("[data-zoomart]");
    if (z) { var a = S.artwork(z.dataset.zoomart); if (a) lightbox('<img src="' + esc(a.img) + '" alt="">', esc(a.artist || "")); return; }
    var card = e.target.closest(".card"); if (!card) return;
    var c = byId(card.dataset.id); if (!c) return;
    var act = e.target.closest("[data-act]");
    if (act && editing) {
      if (act.dataset.act === "cycle") { setStatus(c, CYCLE[c.status] || "ob"); return; }
      if (act.dataset.act === "edit") { openCardForm(c); return; }
      if (act.dataset.act === "del") { askDelete(c); return; }
    }
    openDetail(c.id);
  });
  $("grid").addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || reorder) return;
    var card = e.target.closest(".card"); if (card && e.target === card) { e.preventDefault(); openDetail(card.dataset.id); }
  });
  function clearFilters() { state.q = ""; state.status = "all"; state.art = "all"; renderAll(); }
  function gotoCard(id) {
    var find = function () { return $("grid").querySelector('.card[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'); };
    if (!find()) { state.q = ""; state.status = "all"; state.art = "all"; renderAll(); }
    var el = find(); if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("flash"); setTimeout(function () { el.classList.remove("flash"); }, 1800);
  }

  // edit mode: only for you, on your own computer or in a browser connected to GitHub (S.canEdit, js/core.js).
  // Visitors never see the Edit button.
  function setEditing(v) {
    if (!S.canEdit) return;
    editing = v;
    document.body.classList.toggle("editing", v);
    $("editBtn").setAttribute("aria-pressed", String(v));
    $("editBtn").querySelector("span").textContent = v ? "Done" : "Edit";
    $("editbar").hidden = !v;
    store("xscizorr-editing", v ? "1" : "");
    if (!v && reorder) { reorder = false; $("reorderBtn").setAttribute("aria-pressed", "false"); $("reorderBtn").textContent = "Reorder"; }
    renderAll();
    if (openId && !$("ovDetail").hidden) showDetail(openId);
  }
  $("editBtn").addEventListener("click", function () {
    setEditing(!editing);
    if (editing) S.toast("Edit mode on. Click a status to change it.");
  });
  $("addBtn").addEventListener("click", function () { openCardForm(null); });

  // data + backup
  $("csvAll").addEventListener("click", function () { S.download("scizor-all-cards-" + S.today() + ".csv", S.csv(all), "text/csv;charset=utf-8"); });
  function openData() {
    $("dataStatus").textContent = GH.connected()
      ? (S.isDirty() ? "Some changes haven't been saved to GitHub yet. They go with your next change, or now:" : "Every change is saved to GitHub.")
      : S.hasLocalChanges()
        ? "This browser has edits that aren't in your website's data file yet. Export the data file to publish them."
        : "Everything here matches your website's data file. There are no unpublished edits.";
    if (GH.connected() && S.isDirty()) GH.saveNow();
    ghRow();
    openOv("ovData");
  }

  // ------------------------------------------------------------ editing from the live site (js/github.js)
  // Connected to the site's GitHub repository, each change is saved there and the live site updates by itself.
  // Opening a page with ?owner on the end asks for the access key; Data & backup can connect or disconnect too.
  var GH = window.ScizorGitHub;
  var NOTE = {
    local: "Changes are saved in this browser. Export the data file to publish them on your website.",
    live: "Changes are saved to GitHub, and the live site shows them a minute or two later.",
    waiting: "Saving to GitHub…", saving: "Saving to GitHub…",
    saved: "Saved to GitHub. The live site shows it in a minute or two."
  };
  function ghRow() {
    $("ghStatus").textContent = GH.connected()
      ? "Connected to " + GH.repo() + ". Your changes are saved there, and the live site shows them a minute or two later."
      : "Save your changes straight to the site's GitHub repository, so the live site updates without uploading.";
    $("ghBtn").textContent = GH.connected() ? "Disconnect" : "Connect";
  }
  function openGithub() {
    var g = GH.guess();
    $("gh-owner").value = g.owner; $("gh-repo").value = g.repo; $("gh-token").value = ""; $("gh-msg").textContent = "";
    openOv("ovGithub");
  }
  GH.onStatus(function (state, detail) {
    $("editNote").textContent = state === "failed" ? "Not saved to GitHub yet: " + detail + " Your changes are kept in this browser and go with your next one." : NOTE[state];
    if (state === "failed") S.toast("Couldn't save to GitHub. " + detail);
  });
  $("ghBtn").addEventListener("click", function () {
    if (!GH.connected()) { closeOv("ovData"); openGithub(); return; }
    confirmBox("Disconnect from GitHub?", "This browser stops saving to " + GH.repo() + ". Changes already saved stay on the live site.", "Disconnect").then(function (ok) {
      if (!ok) return;
      GH.disconnect();
      location.reload();   // on the live site, editing goes with it
    });
  });
  $("ghForm").addEventListener("submit", function (e) {
    e.preventDefault();
    $("gh-go").disabled = true; $("gh-msg").textContent = "Checking with GitHub…";
    GH.connect($("gh-owner").value, $("gh-repo").value, $("gh-token").value).then(function () {
      $("gh-token").value = "";
      // Open again with editing on, without ?owner
      store("xscizorr-editing", "1");
      location.replace(location.pathname + location.search.replace(/[?&]owner\b(=[^&]*)?/, "").replace(/^&/, "?") + location.hash);
    }, function (err) { $("gh-msg").textContent = err.message; }).then(function () { $("gh-go").disabled = false; });
  });
  $("dataBtn").addEventListener("click", openData);
  $("dataBtn2").addEventListener("click", openData);
  $("exportSite").addEventListener("click", function () {
    S.download("cards.js", S.siteDataFile(), "text/javascript;charset=utf-8");
    S.toast("Downloaded cards.js. Replace data/cards.js in your website folder with it.");
  });
  $("backupBtn").addEventListener("click", function () { S.download("xscizorr-backup-" + S.today() + ".json", S.backup(), "application/json"); });
  $("restoreFile").addEventListener("change", function () {
    var f = $("restoreFile").files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try { S.restore(String(r.result)).then(function () { closeOv("ovData"); refresh(); S.toast("Backup restored"); }); }
      catch (err) { S.toast(err.message || "That file couldn't be restored."); }
      $("restoreFile").value = "";
    };
    r.readAsText(f);
  });
  $("resetBtn").addEventListener("click", function () {
    confirmBox("Discard edits in this browser?", "Statuses, prices, photos and cards you added here will be lost unless they're in a backup or an exported data file.", "Discard").then(function (ok) {
      if (!ok) return; S.resetLocal(); closeOv("ovData"); refresh(); S.toast("Edits discarded");
    });
  });

  window.addEventListener("hashchange", function () {
    var h = applyHash(); renderAll();
    if (h.card && byId(h.card)) openDetail(h.card);
  });

  // ------------------------------------------------------------ the bottom bar
  // Says which card is pointed at (its set, number and card type), as the game's bottom bar describes the choice
  var HINT = "Choose a card to see it";
  function describe(el) {
    var c = el && byId(el.getAttribute("data-id"));
    if (!c) { $("dsmMsg").textContent = HINT; return; }
    $("dsmMsg").innerHTML = [c.set, c.num, c.type].filter(Boolean).map(esc).join(DOT);
  }
  $("grid").addEventListener("pointerover", function (e) { describe(e.target.closest(".card")); });
  $("grid").addEventListener("pointerleave", function () { describe(null); });
  $("grid").addEventListener("focusin", function (e) { describe(e.target.closest(".card")); });

  // ------------------------------------------------------------ start
  load();
  var start = applyHash();
  // A link to a card printed in another language goes to that language's page
  var startCard = start.card ? byId(start.card) : null;
  if (startCard && startCard.lang !== LANG.code) { location.replace(S.cardURL(startCard.id)); return; }
  var v = stored("xscizorr-view"); if (v === "rows" || v === "art" || v === "grid") state.view = v;
  editing = S.canEdit && stored("xscizorr-editing") === "1";
  if (!S.canEdit) $("editBtn").style.display = "none";
  document.body.classList.toggle("editing", editing);
  $("editBtn").setAttribute("aria-pressed", String(editing));
  $("editBtn").querySelector("span").textContent = editing ? "Done" : "Edit";
  $("editbar").hidden = !editing;
  $("editNote").textContent = GH.connected() ? NOTE.live : NOTE.local;
  if (GH.connected()) $("dataBtn2").textContent = "Data & backup";
  renderIntro();
  renderAll();
  describe(null);
  if (/[?&]owner\b/.test(location.search) && !GH.connected()) openGithub();
  if (startCard) { openDetail(startCard.id); gotoCard(startCard.id); }
  else if (start.art) toCards();
  S.loadImages().then(function (imgs) { if (Object.keys(imgs).length) renderAll(); });
})();
