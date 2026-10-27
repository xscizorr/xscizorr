/* Shared by every page: the card database, your saved edits, and small rendering helpers.

   Where the data comes from:
     - data/cards.js   the snapshot built from the Google Sheet (tools/import-sheet.ps1)
     - localStorage    your edits on this site (status changes, prices, new cards...)
     - IndexedDB       photos you upload for cards and items
   Edits are stored as changes on top of the snapshot, so re-importing the sheet keeps them. Editing from the live
   site saves them into data/cards.js on GitHub too (js/github.js). */
(function () {
  "use strict";

  var SEED = window.SCIZOR_SEED || { cards: [], artworks: [], items: [] };
  var PHOTOS = window.SCIZOR_PHOTOS || {};   // data/photos.js: card id -> photo name in images/cards/
  var KEY = "xscizorr-tracker-v1";

  // Editing is only for you, the site's owner. It's there when the site is opened on your own computer (straight
  // from the folder, or through tools/serve.ps1), or in a browser you've connected to the site's GitHub repository
  // (js/github.js). Visitors to the published site never see the Edit button. Add ?public to the address to see a
  // page as visitors will.
  var CONNECTED = (function () { try { var g = JSON.parse(localStorage.getItem("xscizorr-github")); return !!(g && g.token); } catch (e) { return false; } })();
  var OWNER = ((location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) || CONNECTED) && !/[?&]public\b/.test(location.search);

  var LANGS = [
    { code: "EN", name: "English", tab: "EN" },
    { code: "JA", name: "Japanese", tab: "JP" },
    { code: "FR", name: "French", tab: "FR" },
    { code: "DE", name: "German", tab: "DE" },
    { code: "IT", name: "Italian", tab: "IT" },
    { code: "ES", name: "Spanish", tab: "ES" },
    { code: "LA", name: "Spanish (Latin America)", tab: "ES-LA" },
    { code: "PT", name: "Portuguese", tab: "PT" },
    { code: "KO", name: "Korean", tab: "KR" },
    { code: "ZT", name: "Traditional Chinese", tab: "CN-T" },
    { code: "ZS", name: "Simplified Chinese", tab: "CN-S" },
    { code: "ID", name: "Indonesian", tab: "ID" },
    { code: "TH", name: "Thai", tab: "TH" },
    { code: "PL", name: "Polish", tab: "PL" },
    { code: "RU", name: "Russian", tab: "RU" }
  ];
  var STATUS = { ob: "Obtained", tr: "In transit", un: "Unobtained" };
  var STATUS_ORDER = ["ob", "tr", "un"];
  var CATS = [
    { id: "set", name: "Master Set", kind: "cards", title: "Scizor Master Set" },
    { id: "cameo", name: "Cameos", kind: "cards", title: "Scizor Cameos" },
    { id: "other", name: "Others", kind: "items", title: "Other Scizor Collectibles" }
  ];

  // ------------------------------------------------------------ local edits
  // pushed and dirty follow saving to GitHub: when the last save was (its savedAt), and whether there are edits
  // since that haven't been saved yet
  function blank() { return { v: 1, patches: {}, added: [], deleted: [], order: null, items: null, touched: {}, pushed: 0, dirty: false }; }
  function loadLocal() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 1) {
        var b = blank(); for (var k in b) if (s[k] !== undefined) b[k] = s[k];
        // Edits already saved to GitHub are let go once the site's data file includes them, so the data file is
        // what counts from then on (and changes made on another computer since then show here too)
        if (b.pushed && !b.dirty && (SEED.savedAt || 0) >= b.pushed) { b = blank(); localStorage.setItem(KEY, JSON.stringify(b)); }
        return b;
      }
    } catch (e) {}
    return blank();
  }
  var local = loadLocal();
  var listeners = [], edits = 0;
  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(local)); }
    catch (e) { toast("Couldn't save. Your browser storage may be full or blocked."); }
    seen = saved();
  }
  function persist() {
    local.dirty = true; edits++;
    write();
    listeners.forEach(function (fn) { fn(); });
  }
  // After a save to GitHub: the edits up to then are in the data file (unless more were made while it saved)
  function markPushed(savedAt, editsThen) {
    if (edits !== editsThen) return;
    local.pushed = savedAt; local.dirty = false; write();
  }

  // Every page works out its numbers from your edits (the homepage, the Collection page, the checklist and the
  // language pages). A page that was already open catches up as soon as you come back to it, from another tab or
  // with the Back button (which can show a page exactly as it was left): if your edits changed meanwhile, it loads
  // again. The homepage does so without its cover.
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  var seen = saved();
  function catchUp() {
    if (saved() === seen) return;
    try { sessionStorage.setItem("xscizorr-nocover", "1"); } catch (e) {}
    location.reload();
  }
  window.addEventListener("pageshow", function (e) { if (e.persisted) catchUp(); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") catchUp(); });

  function copy(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }
  function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function isSeed(id) { return SEED.cards.some(function (c) { return c.id === id; }); }

  // A data file's cards with your edits on top, in your order (the site's own data file, or the one on GitHub)
  function merged(seed) {
    var del = {}; local.deleted.forEach(function (id) { del[id] = 1; });
    var out = [];
    (seed.cards || []).forEach(function (c) {
      if (del[c.id]) return;
      var m = copy(c), p = local.patches[c.id];
      if (p) for (var k in p) m[k] = p[k];
      out.push(m);
    });
    local.added.forEach(function (c) { out.push(copy(c)); });
    out.forEach(function (c, i) { if (!c.cat) c.cat = "set"; c._i = i; });
    if (local.order) {
      var pos = {}; local.order.forEach(function (id, i) { pos[id] = i; });
      out.sort(function (a, b) {
        var pa = pos[a.id], pb = pos[b.id];
        if (pa === undefined && pb === undefined) return a._i - b._i;
        if (pa === undefined) return 1; if (pb === undefined) return -1;
        return pa - pb;
      });
    }
    return out;
  }
  // The cards everyone sees: the site's data file with your edits, and each card's photo from data/photos.js
  function cards() {
    var out = merged(SEED);
    out.forEach(function (c) {
      var ph = PHOTOS[c.id];
      if (ph && !c.img) {
        var front = typeof ph === "string" ? ph : ph[0], back = typeof ph === "string" ? "" : ph[1];
        c.img = photoPath(front, false); c.thumb = photoPath(front, true);
        if (back) c.back = photoPath(back, false);
      }
    });
    return out;
  }
  function items() { return (local.items || SEED.items || []).map(copy); }
  // A bare name like "scizor044" means images/cards/scizor044.jpg (and its thumbnail); a path is used as given
  function photoPath(name, thumb) {
    if (/[\/.]/.test(name)) return name;
    return "images/cards/" + (thumb ? "thumbs/" : "") + name + ".jpg";
  }

  function updateCard(id, fields) {
    var hit = local.added.filter(function (c) { return c.id === id; })[0];
    if (hit) { for (var k in fields) hit[k] = fields[k]; }
    else { local.patches[id] = local.patches[id] || {}; for (var j in fields) local.patches[id][j] = fields[j]; }
    local.touched[id] = Date.now();
    persist();
  }
  function addCard(card) {
    var c = copy(card); c.id = uid("u");
    local.added.push(c); local.touched[c.id] = Date.now();
    persist(); return c;
  }
  function deleteCard(id) {
    if (isSeed(id)) { if (local.deleted.indexOf(id) < 0) local.deleted.push(id); delete local.patches[id]; }
    else local.added = local.added.filter(function (c) { return c.id !== id; });
    if (local.order) local.order = local.order.filter(function (x) { return x !== id; });
    delete local.touched[id];
    removeImage(id);
    persist();
  }
  function setOrder(ids) { local.order = ids; persist(); }

  function saveItems(list) { local.items = list; persist(); }
  function upsertItem(item) {
    var list = items(), i = -1;
    if (item.id) list.forEach(function (x, k) { if (x.id === item.id) i = k; });
    if (i >= 0) list[i] = item; else { item.id = uid("i"); list.push(item); }
    local.touched[item.id] = Date.now();
    saveItems(list); return item;
  }
  function deleteItem(id) { saveItems(items().filter(function (x) { return x.id !== id; })); removeImage(id); }

  function artwork(id) { return (SEED.artworks || []).filter(function (a) { return a.id === id; })[0] || null; }

  // ------------------------------------------------------------ photos (IndexedDB)
  var IMG = {};
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error("no indexedDB")); return; }
      var r = indexedDB.open("xscizorr-images", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("img"); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function loadImages() {
    return db().then(function (d) {
      return new Promise(function (res) {
        var tx = d.transaction("img", "readonly"), st = tx.objectStore("img"), req = st.openCursor();
        req.onsuccess = function () { var c = req.result; if (c) { IMG[c.key] = c.value; c.continue(); } else res(IMG); };
        req.onerror = function () { res(IMG); };
      });
    }).catch(function () { return IMG; });
  }
  function setImage(id, dataUrl) {
    IMG[id] = dataUrl;
    return db().then(function (d) { d.transaction("img", "readwrite").objectStore("img").put(dataUrl, id); })
      .catch(function () { toast("Couldn't store the photo in this browser."); });
  }
  function removeImage(id) {
    if (!IMG[id]) return;
    delete IMG[id];
    db().then(function (d) { d.transaction("img", "readwrite").objectStore("img").delete(id); }).catch(function () {});
  }
  // img "none" means the photo was removed on purpose, so data/photos.js doesn't put it back
  function photoFor(c) { return IMG[c.id] || (c.img && c.img !== "none" ? c.img : ""); }

  // Shrink an uploaded photo so hundreds of them still fit in the browser
  function resizeImage(file, max) {
    max = max || 900;
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onerror = function () { rej(fr.error); };
      fr.onload = function () {
        var im = new Image();
        im.onerror = function () { rej(new Error("Not an image")); };
        im.onload = function () {
          var s = Math.min(1, max / Math.max(im.width, im.height));
          var cv = document.createElement("canvas");
          cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s);
          var g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
          g.drawImage(im, 0, 0, cv.width, cv.height);
          res(cv.toDataURL("image/jpeg", 0.86));
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  // ------------------------------------------------------------ numbers
  function tally(list) {
    var t = { ob: 0, tr: 0, un: 0, total: list.length, value: 0 };
    list.forEach(function (c) { t[c.status] = (t[c.status] || 0) + 1; if (c.status === "ob") t.value += Number(c.price) || 0; });
    t.pct = t.total ? Math.floor((t.ob / t.total) * 1000) / 10 : 0;
    return t;
  }
  function pctText(t) { var p = t.pct; return (p % 1 ? p.toFixed(1) : String(p)) + "%"; }
  function langName(code) { var l = LANGS.filter(function (x) { return x.code === code; })[0]; return l ? l.name : code || "-"; }
  function langTab(code) { var l = LANGS.filter(function (x) { return x.code === code; })[0]; return l ? l.tab : code; }

  // Each language has its own page (language.html?lang=JA). These build links to it, to a card on it,
  // or to an artwork's prints (on the page of its English print, or its first print if it has no English one).
  function langURL(code) { return "language.html?lang=" + encodeURIComponent(code); }
  function cardURL(id) {
    var c = cards().filter(function (x) { return x.id === id; })[0];
    return c ? langURL(c.lang) + "#card=" + encodeURIComponent(id) : "collection.html";
  }
  function artURL(id) {
    var prints = cards().filter(function (x) { return x.art === id && x.cat === "set"; });
    var first = prints.filter(function (x) { return x.lang === "EN"; })[0] || prints[0];
    return first ? langURL(first.lang) + "#art=" + encodeURIComponent(id) : "collection.html";
  }
  // The languages shown on the Collection page, in order: every language with Master Set cards.
  function collectionLangs() {
    var all = cards();
    return LANGS.filter(function (l) { return all.some(function (c) { return c.cat === "set" && c.lang === l.code; }); });
  }
  var CURRENCY = (window.SCIZOR_CONFIG && window.SCIZOR_CONFIG.currency) || "USD";
  function money(v) {
    if (v === "" || v === null || v === undefined || isNaN(Number(v))) return "-";
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY, maximumFractionDigits: Number(v) % 1 ? 2 : 0 }).format(Number(v)); }
    catch (e) { return "$" + Number(v).toFixed(2); }
  }
  function fmtDate(d) {
    if (!d) return "-";
    var p = String(d).split("-"); if (p.length !== 3) return d;
    var dt = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(dt) ? d : dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  // ------------------------------------------------------------ html helpers
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }

  function variantClass(type) {
    var t = String(type || "").toLowerCase(), cls = [];
    var full = /full art|illustration|art rare|\b(ir|ar|sr|sar|hr|ssr|ur|s|chr|csr)\b|hyper|rainbow|shiny/.test(t);
    if (full) cls.push("v-full");
    if (/rainbow|hyper|\bhr\b/.test(t)) cls.push("v-rainbow");
    if (/\bur\b|gold/.test(t)) cls.push("v-gold");
    if (!full && /reverse|rev holo/.test(t)) cls.push("v-rev");
    if (!full && /promo/.test(t)) cls.push("v-promo");
    if (/holo|cosmos|\brrr?\b|box topper|shiny/.test(t)) cls.push(/shiny/.test(t) ? "v-shiny" : "v-holo");
    return cls.join(" ");
  }

  // A card: the photo when there is one, otherwise a card-shaped frame around the sheet's artwork
  function face(c, opts) {
    opts = opts || {};
    var dim = opts.dim && c.status === "un" ? " is-un" : "";
    var photo = photoFor(c);
    if (photo) {
      var src = opts.thumb && !IMG[c.id] && c.thumb ? c.thumb : photo;
      return '<div class="face photo' + dim + '"><img src="' + esc(src) + '" alt="' + esc(c.name + " " + (c.num || "")) + '" loading="lazy"></div>';
    }
    var a = artwork(c.art);
    return '<div class="face ' + variantClass(c.type) + dim + '" role="img" aria-label="' + esc(c.name + ", " + (c.set || "") + " " + (c.num || "")) + '"><div class="f-in">' +
      '<div class="f-head"><b>' + esc(c.name) + '</b><i>' + esc(c.num || "") + '</i></div>' +
      '<div class="f-art"' + (a ? ' style="background-image:url(\'' + esc(a.img) + '\')"' : '') + '></div>' +
      '<div class="f-body"><div class="f-line"></div><div class="f-line short"></div><div class="f-line"></div></div>' +
      (c.type ? '<div class="f-type">' + esc(c.type) + '</div>' : '') +
      '<div class="f-foot"><span>' + esc(c.set || "") + '</span>' + (c.sym ? '<img src="' + esc(c.sym) + '" alt="">' : '') + '</div></div></div>';
  }

  function pill(status, tag) {
    tag = tag || "span";
    return '<' + tag + ' class="pill s-' + status + '"' + (tag === "button" ? ' type="button" data-act="cycle" title="Click to change status"' : '') + '><i></i>' + STATUS[status] + '</' + tag + '>';
  }
  function gradeBadge(g) {
    if (!g) return "";
    if (/^raw$/i.test(g)) return '<span class="grade raw">RAW</span>';
    return '<span class="grade">' + esc(g) + '</span>';
  }

  var toastTimer;
  function toast(msg) {
    var t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }

  function download(name, text, type) {
    var blob = text instanceof Blob ? text : new Blob([text], { type: type || "text/plain;charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  // ------------------------------------------------------------ export / import
  function csv(list) {
    var cols = [["Name", "name"], ["Language", function (c) { return langName(c.lang); }], ["Set", "set"], ["Set (native)", "native"], ["Set code", "code"],
      ["Number", "num"], ["Card type", "type"], ["Status", function (c) { return STATUS[c.status]; }], ["Grade", "grade"], ["Artist", "artist"],
      ["Release date", "date"], ["Price", "price"], ["Notes", "note"], ["Category", function (c) { var k = CATS.filter(function (x) { return x.id === c.cat; })[0]; return k ? k.name : c.cat; }]];
    var q = function (v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rows = [cols.map(function (c) { return c[0]; }).join(",")];
    list.forEach(function (c) { rows.push(cols.map(function (k) { return q(typeof k[1] === "function" ? k[1](c) : c[k[1]]); }).join(",")); });
    return "﻿" + rows.join("\r\n");
  }
  function strip(c) { var o = copy(c); delete o._i; return o; }
  // A new data/cards.js containing everything, photos you uploaded included, so the published site matches this
  // browser. Built on the site's own data file, or (when saving to GitHub) on the one there now. savedAt marks
  // when, so a browser knows when the published file has caught up with its edits (see loadLocal).
  function dataFileFor(seed, savedAt, note) {
    var now = new Date();
    var out = {
      generated: today() + "T" + now.toTimeString().slice(0, 8), savedAt: savedAt || now.getTime(), source: seed.source || SEED.source || "",
      artworks: seed.artworks || SEED.artworks || [],
      cards: merged(seed).map(function (c) { var o = strip(c); if (IMG[c.id]) o.img = IMG[c.id]; return o; }),
      items: (local.items || seed.items || []).map(function (c) { var o = strip(c); if (IMG[c.id]) o.img = IMG[c.id]; return o; })
    };
    return "// " + (note || "Exported from the xscizorr website") + " on " + today() + ". This is the site's card list (data/cards.js).\n" +
      "window.SCIZOR_SEED = " + JSON.stringify(out) + ";\n";
  }
  function siteDataFile() { return dataFileFor(SEED, 0, "Exported from the xscizorr website"); }
  function backup() { return JSON.stringify({ app: "xscizorr", v: 1, saved: new Date().toISOString(), local: local, images: IMG }); }
  function restore(text) {
    var o = JSON.parse(text);
    if (!o || o.app !== "xscizorr" || !o.local || o.local.v !== 1) throw new Error("This doesn't look like an xscizorr backup file.");
    local = loadFrom(o.local);
    var imgs = o.images || {};
    return Promise.all(Object.keys(imgs).map(function (id) { return setImage(id, imgs[id]); })).then(persist);
  }
  function loadFrom(s) { var b = blank(); for (var k in b) if (s[k] !== undefined) b[k] = s[k]; return b; }
  function resetLocal() {
    local = blank(); write();
    listeners.forEach(function (fn) { fn(); });
    Object.keys(IMG).forEach(removeImage);
  }
  function hasLocalChanges() {
    return Object.keys(local.patches).length || local.added.length || local.deleted.length || local.order || local.items || Object.keys(IMG).length;
  }

  // ------------------------------------------------------------ page chrome
  function initChrome() {
    var head = document.querySelector(".site-head");
    if (head) {
      var onScroll = function () { head.classList.toggle("scrolled", window.scrollY > 4); };
      window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    }
    // Menu: the xscizorr pill widens to the right. The links' width is measured so the pill can grow
    // smoothly from 0 to exactly that width (CSS can't animate to "auto").
    var menu = document.getElementById("menu"), menuBtn = document.getElementById("menuBtn"), panel = document.getElementById("menuPanel");
    if (menu && menuBtn && panel) {
      // offsetWidth of the links row (not scrollWidth) so the links' slide-in offset isn't subtracted
      var fit = function () { panel.style.width = menu.classList.contains("open") ? panel.firstElementChild.offsetWidth + "px" : "0px"; };
      var setMenu = function (open) {
        menu.classList.toggle("open", open);
        document.body.classList.toggle("menu-open", open);
        menuBtn.setAttribute("aria-expanded", String(open));
        menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        fit();
      };
      var toggle = function () { setMenu(!menu.classList.contains("open")); };
      menuBtn.addEventListener("click", toggle);
      Array.prototype.forEach.call(menu.querySelectorAll("[data-menu-toggle]"), function (b) { b.addEventListener("click", toggle); });
      window.addEventListener("resize", fit);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
      document.addEventListener("click", function (e) { if (menu.classList.contains("open") && !menu.contains(e.target)) setMenu(false); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && menu.classList.contains("open")) { e.stopImmediatePropagation(); setMenu(false); menuBtn.focus(); }
      }, true);
    }

    // The theme button: the site starts dark (js/theme.js sets it in the <head>), and remembers a switch
    var tb = document.getElementById("themeBtn");
    if (tb) {
      tb.addEventListener("click", function () {
        var next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", next);
        try { localStorage.setItem("xscizorr-mode", next); } catch (e) {}
      });
    }
    var y = document.getElementById("year"); if (y) y.textContent = new Date().getFullYear();
    var gen = document.getElementById("generated");
    if (gen && SEED.generated) gen.textContent = fmtDate(SEED.generated.slice(0, 10));
  }

  window.Scizor = {
    SEED: SEED, LANGS: LANGS, STATUS: STATUS, STATUS_ORDER: STATUS_ORDER, CATS: CATS, canEdit: OWNER,
    cards: cards, items: items, artworks: function () { return SEED.artworks || []; }, artwork: artwork,
    updateCard: updateCard, addCard: addCard, deleteCard: deleteCard, setOrder: setOrder,
    upsertItem: upsertItem, deleteItem: deleteItem, saveItems: saveItems,
    touched: function (id) { return local.touched[id] || 0; }, hasOrder: function () { return !!local.order; },
    loadImages: loadImages, setImage: setImage, removeImage: removeImage, photoFor: photoFor, resizeImage: resizeImage,
    tally: tally, pctText: pctText, langName: langName, langTab: langTab, money: money, fmtDate: fmtDate,
    langURL: langURL, cardURL: cardURL, artURL: artURL, collectionLangs: collectionLangs,
    esc: esc, face: face, pill: pill, gradeBadge: gradeBadge, toast: toast, download: download, today: today,
    csv: csv, siteDataFile: siteDataFile, dataFileFor: dataFileFor, backup: backup,
    isDirty: function () { return local.dirty; }, editCount: function () { return edits; }, markPushed: markPushed, restore: restore, resetLocal: resetLocal, hasLocalChanges: hasLocalChanges,
    onChange: function (fn) { listeners.push(fn); }, initChrome: initChrome
  };
})();
