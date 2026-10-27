/* The entire checklist (checklist.html), on the same Pokémon Black and White screen as the Collection menu. A panel
   at the top has the totals, progress by language (like the sheet's summary) and the key. Under it, every Master
   Set card in every language is in one table, laid out like the Google Sheet it came from, with both of the
   sheet's tabs (ENG / JPN, and every other language) together. Cards are grouped by artwork, with the artwork and
   its artist down the left and a column for each language: a card's status sits in its own language's column.
   Clicking a card opens it on its language's page (language.html). Styles in css/collection.css (the screen) and
   css/checklist.css. */
(function () {
  "use strict";
  var S = window.Scizor, DS = window.ScizorDS, esc = S.esc;
  var $ = function (id) { return document.getElementById(id); };
  var table = $("clTable");
  if (!table) return;
  S.initChrome();
  DS.clock($("dsmClock"));
  $("clIcon").innerHTML = DS.pixels("list");

  // The menu font has no "·" or brackets: square dots go between the parts of a line, and a name with brackets
  // is said another way
  var DOT = '<i class="dsm-dot"></i>', NAMES = { LA: "Latin American Spanish" };
  function name(code) { return NAMES[code] || S.langName(code); }

  // The language columns, in the sheet's order and with its names. Any other language with cards comes after.
  var COLS = [["EN", "ENG"], ["JA", "JPN"], ["DE", "GER"], ["FR", "FRE"], ["IT", "ITA"], ["PT", "PORT"], ["ES", "ESP"],
    ["LA", "ESP-LA"], ["KO", "KOR"], ["ZS", "CN-S"], ["ZT", "CN-T"], ["ID", "INDO"], ["TH", "THAI"]];
  var cards = S.cards().filter(function (c) { return c.cat === "set"; });
  var present = S.collectionLangs().map(function (l) { return l.code; });
  var cols = COLS.filter(function (c) { return present.indexOf(c[0]) >= 0; });
  present.forEach(function (code) { if (!cols.some(function (c) { return c[0] === code; })) cols.push([code, S.langTab(code)]); });

  // ------------------------------------------------------------ the totals
  var all = S.tally(cards);
  $("clSum").innerHTML = cards.length + " cards in " + cols.length + " languages" + DOT + all.ob + " obtained, " + S.pctText(all) +
    DOT + all.tr + " in transit" + DOT + all.un + " unobtained";

  // ------------------------------------------------------------ progress by language, like the sheet's summary
  // In the sheet's order, each with obtained + in transit / total, a bar (obtained red, in transit grey) and the
  // share obtained. A language with no cards (Polish, Russian) is struck through, as in the sheet.
  var ORDER = ["EN", "JA", "FR", "IT", "PT", "ES", "LA", "PL", "RU", "DE", "KO", "TH", "ID", "ZT", "ZS"];
  var GOAL = { EN: "PSA 9/10", JA: "PSA 10" };   // the grades each is collected in, as noted in the sheet
  var FLAGS = window.SCIZOR_FLAGS || {};
  var order = ORDER.concat(present.filter(function (code) { return ORDER.indexOf(code) < 0; }));
  function pct(n, t) { return (n / t * 100) + "%"; }
  function line(cls, head, t) {
    var none = !t.total;
    return '<div class="cl-row' + (cls ? " " + cls : "") + (none ? " is-none" : "") + '" role="row">' + head +
      '<span class="cl-n" role="cell" aria-label="' + (none ? "No cards" : t.ob + " obtained, " + t.tr + " in transit, of " + t.total) + '">' +
      "<b>" + (none ? "–" : t.ob) + "</b><i>+</i><b>" + (none ? "–" : t.tr) + "</b><i>/</i><b>" + (none ? "–" : t.total) + "</b></span>" +
      '<span class="cl-track" role="cell">' + (t.ob ? '<i class="b-ob" style="width:' + pct(t.ob, t.total) + '"></i>' : "") +
        (t.tr ? '<i class="b-tr" style="width:' + pct(t.tr, t.total) + '"></i>' : "") + "</span>" +
      '<span class="cl-pct" role="cell">' + (none ? "–%" : S.pctText(t)) + "</span></div>";
  }
  $("clGraph").innerHTML =
    '<div class="cl-graph-head"><span>Progress by language</span><span class="cl-legend" aria-hidden="true"><i class="b-ob"></i>Obtained<i class="b-tr"></i>In transit</span></div>' +
    '<div class="sr" role="row"><span role="columnheader">Language</span><span role="columnheader">Obtained + in transit / total</span><span role="columnheader">Progress</span><span role="columnheader">Obtained</span></div>' +
    order.map(function (code) {
      var t = S.tally(cards.filter(function (c) { return c.lang === code; }));
      return line(code === "EN" || code === "JA" ? "is-main" : "",
        '<span class="cl-lang-name" role="rowheader"><span class="cl-flag">' + (FLAGS[code] || "") + "</span><span>" + esc(name(code)) +
        (GOAL[code] ? "<small>" + esc(GOAL[code]) + "</small>" : "") + "</span></span>", t);
    }).join("") +
    line("is-total", '<span class="cl-lang-name" role="rowheader"><span class="cl-flag cl-globe">' + DS.pixels("globe") + "</span><span>Total cards collected</span></span>", all);

  // ------------------------------------------------------------ the table
  // A card's status as a chip, coloured like the sheet's: PSA 10 dark green, PSA 9 light green, other grades
  // purple, raw yellow, in transit brown, unobtained red
  function chip(c) {
    if (c.status === "un") return '<span class="chip k-need">Unobtained</span>';
    if (c.status === "tr") return '<span class="chip k-way">In transit</span>';
    var g = String(c.grade || "").trim();
    var k = /^psa 10$/i.test(g) ? "k-10" : /^psa 9$/i.test(g) || !g ? "k-9" : /^raw$/i.test(g) ? "k-raw" : "k-low";
    return '<span class="chip ' + k + '">' + esc(g || "Obtained") + "</span>";
  }
  // "1st Edition · Non-Holo": the first part in bold, as in the sheet
  function type(t) {
    var parts = String(t || "").split(" · ");
    return parts.length > 1 ? "<b>" + esc(parts[0]) + "</b> · " + esc(parts.slice(1).join(" · ")) : esc(t || "");
  }

  // One group per artwork, in the order the artworks first appear (the sheet's), each card in its list's order
  var groups = [], byArt = {}, byId = {};
  cards.forEach(function (c) {
    var k = c.art || "";
    if (!byArt[k]) { byArt[k] = { art: S.artwork(c.art), artist: "", cards: [] }; groups.push(byArt[k]); }
    if (!byArt[k].artist) byArt[k].artist = c.artist || "";
    byArt[k].cards.push(c);
    byId[c.id] = c;
  });

  // Each group starts with its own header row, like the sheet's blocks
  var head = '<tr class="cl-cols"><th scope="col">Artwork</th><th scope="col">Card name</th><th scope="col">Index</th>' +
    '<th scope="col">Set name</th><th scope="col">Card type</th>' +
    cols.map(function (c) { return '<th scope="col" class="cl-lang"><abbr title="' + esc(S.langName(c[0])) + '">' + esc(c[1]) + "</abbr></th>"; }).join("") + "</tr>";
  table.innerHTML = '<caption class="sr">Every Scizor card in every language, grouped by artwork</caption>' + groups.map(function (g) {
    var a = g.art;
    var art = '<td class="cl-art" rowspan="' + g.cards.length + '">' +
      (a ? '<img src="' + esc(a.img) + '" width="' + a.w + '" height="' + a.h + '" alt="" loading="lazy">' : "") +
      (g.artist ? '<span class="cl-artist">' + esc(g.artist) + "</span>" : "") + "</td>";
    return "<tbody>" + head + g.cards.map(function (c, i) {
      var url = S.langURL(c.lang) + "#card=" + encodeURIComponent(c.id);
      return '<tr class="cl-card" data-id="' + esc(c.id) + '" data-href="' + esc(url) + '">' + (i ? "" : art) +
        '<td class="cl-name"><a href="' + esc(url) + '">' + esc(c.name) + "</a></td>" +
        '<td class="cl-num">' + esc(c.num || "–") + "</td>" +
        '<td class="cl-set"><div>' + (c.sym ? '<img src="' + esc(c.sym) + '" alt="" loading="lazy">' : "") + "<span>" + esc(c.set || "–") + "</span></div></td>" +
        '<td class="cl-type">' + type(c.type) + "</td>" +
        cols.map(function (col) { return col[0] === c.lang ? '<td class="cl-st">' + chip(c) + "</td>" : '<td class="cl-na"></td>'; }).join("") + "</tr>";
    }).join("") + "</tbody>";
  }).join("");

  // Anywhere on a card's row opens it (the name is the link itself, for the keyboard)
  table.addEventListener("click", function (e) {
    var tr = e.target.closest("tr[data-href]");
    if (!tr || e.target.closest("a, .cl-art") || String(window.getSelection())) return;
    location.href = tr.getAttribute("data-href");
  });

  // ------------------------------------------------------------ the bottom bar
  // Says which card is pointed at (its language, set and number), as the game's bottom bar describes the choice
  var msg = $("dsmMsg"), HINT = "Choose a card to see it";
  msg.textContent = HINT;
  function describe(tr) {
    var c = tr && byId[tr.getAttribute("data-id")];
    if (!c) { msg.textContent = HINT; return; }
    msg.innerHTML = esc(name(c.lang)) + DOT + esc(c.set || "") + (c.num ? DOT + esc(c.num) : "");
  }
  table.addEventListener("pointerover", function (e) { describe(e.target.closest("tr.cl-card")); });
  table.addEventListener("pointerleave", function () { describe(null); });
  table.addEventListener("focusin", function (e) { describe(e.target.closest("tr.cl-card")); });
})();
