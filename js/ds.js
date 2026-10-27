/* Shared by the pages drawn like Pokémon Black and White's touch screen: the Collection menu (js/collection.js)
   and the entire checklist (js/checklist.js). The little pixel icons, and the clock in the status bar. The
   screen's look is in css/collection.css. */
(function () {
  "use strict";

  // Little pixel drawings in the style of the game's menu icons, 16 × 16: one letter per pixel ("." is empty),
  // coloured by the icon's palette
  var ICONS = {
    ball: { pal: { K: "#1b1b1d", R: "#e3303c", W: "#f4f4f4", w: "#c4c7cf" }, px: [
      "................",
      ".....KKKKKK.....",
      "...KKRRRRRRKK...",
      "..KRRRRRRRRRRK..",
      ".KRRWWRRRRRRRRK.",
      ".KRWWRRRRRRRRRK.",
      "KRRRRRRRRRRRRRRK",
      "KRRRRRKKKKRRRRRK",
      "KKKKKKKWWKKKKKKK",
      "KWWWWWKKKKWWWWWK",
      "KWWWWWWWWWWWWWWK",
      ".KWWWWWWWWWWWWK.",
      ".KwWWWWWWWWWWwK.",
      "..KwwWWWWWWwwK..",
      "...KKwwwwwwKK...",
      ".....KKKKKK....."] },
    dex: { pal: { K: "#1b1b1d", P: "#e8467c", L: "#f8b2cb", D: "#a92557" }, px: [
      "................",
      "................",
      "...KKKKKKKKKK...",
      "...KPPPPPPPPK...",
      "...KPLLLLLLPK...",
      "...KPLLLLLLPK...",
      "...KPLLLLLLPK...",
      "...KPPPPPPPPK...",
      "...KPPPPPPPPK...",
      "...KPPDDDDPPK...",
      "...KPDPPPPDPK...",
      "...KPDPPPPDPK...",
      "...KPPDDDDPPK...",
      "...KPPPPPPPPK...",
      "...KKKKKKKKKK...",
      "................"] },
    bag: { pal: { K: "#1b1b1d", R: "#e32b4e", r: "#a81d3a", W: "#f4f4f4" }, px: [
      "................",
      ".....KKKKKK.....",
      "....KRRRRRRK....",
      "...KR......RK...",
      "...KR......RK...",
      "..KKKKKKKKKKKK..",
      ".KRRRRRRRRRRRRK.",
      ".KRRRRRRRRRRRRK.",
      ".KWWWWWWWRRRRRK.",
      ".KRRRRRRWRRRRRK.",
      ".KRRRRRRRRRRRRK.",
      ".KRRRRRRRRRRRRK.",
      ".KrRRRRRRRRRRrK.",
      "..KrrrrrrrrrrK..",
      "...KKKKKKKKKK...",
      "................"] },
    card: { pal: { K: "#1b1b1d", O: "#f39a2b", L: "#fde3b8", C: "#b8661a", S: "#fde3b8", D: "#6b3a10" }, px: [
      "................",
      "................",
      "................",
      ".KKKKKKKKKKKKKK.",
      ".KOOOOOOOOOOOOK.",
      ".KOLLLLLOCCCCOK.",
      ".KOOOOOOOCSSCOK.",
      ".KOLLLOOOCSSCOK.",
      ".KOOOOOOOCDDCOK.",
      ".KOLLLLLOCDDCOK.",
      ".KOOOOOOOCCCCOK.",
      ".KOOOOOOOOOOOOK.",
      ".KKKKKKKKKKKKKK.",
      "................",
      "................",
      "................"] },
    book: { pal: { K: "#1b1b1d", V: "#b58cf2", L: "#efe6ff" }, px: [
      "................",
      "................",
      ".KKKKKK..KKKKKK.",
      "KVVVVVVKKVVVVVVK",
      "KVLLLLVKKVLLLLVK",
      "KVVVVVVKKVVVVVVK",
      "KVLLLLVKKVLLLLVK",
      "KVVVVVVKKVVVVVVK",
      "KVLLLLVKKVLLLLVK",
      "KVVVVVVKKVVVVVVK",
      "KVVVVVVVVVVVVVVK",
      ".KKKKKKVVKKKKKK.",
      ".......KK.......",
      "................",
      "................",
      "................"] },
    ds: { pal: { K: "#1b1b1d", G: "#3fd07a", L: "#c9f7dc", D: "#1f8f4c" }, px: [
      "................",
      "..KKKKKKKKKKKK..",
      "..KGGGGGGGGGGK..",
      "..KGLLLLLLLLGK..",
      "..KGLLLLLLLLGK..",
      "..KGLLLLLLLLGK..",
      "..KGGGGGGGGGGK..",
      "..KKKKKKKKKKKK..",
      "..KGGGGGGGGGGK..",
      "..KDGLLLLLLGDK..",
      "..KGGLLLLLLGGK..",
      "..KDGLLLLLLGDK..",
      "..KGGLLLLLLGGK..",
      "..KGGGGGGGGGGK..",
      "..KKKKKKKKKKKK..",
      "................"] },
    list: { pal: { K: "#1b1b1d", B: "#c98a4b", b: "#8a5a2b", C: "#c4c7cf", W: "#f4f4f4", G: "#9aa0a8", R: "#e3303c" }, px: [
      "................",
      ".....KKKKKK.....",
      "..KKKCCCCCCKKK..",
      "..KBBKKKKKKBBK..",
      "..KBWWWWWWWWBK..",
      "..KBWRWGGGGWBK..",
      "..KBWWWWWWWWBK..",
      "..KBWRWGGGGWBK..",
      "..KBWWWWWWWWBK..",
      "..KBWRWGGGGWBK..",
      "..KBWWWWWWWWBK..",
      "..KBWRWGGGWWBK..",
      "..KBWWWWWWWWBK..",
      "..KbbbbbbbbbbK..",
      "..KKKKKKKKKKKK..",
      "................"] },
    globe: { pal: { K: "#1b1b1d", O: "#3b8fe8", o: "#2263b8", W: "#c9e6ff", G: "#4cc46a" }, px: [
      "................",
      ".....KKKKKK.....",
      "...KKOOGGOOKK...",
      "..KOOGGGGOOOOK..",
      ".KOWOGGGOOOGGOK.",
      ".KWOOOGGOOGGGGK.",
      "KOOOOOGOOOGGGOOK",
      "KOOOOOOOOOOGGOOK",
      "KGGOOOOOOOOGOOOK",
      "KGGGOOOOOOOOOOOK",
      "KOGGGGOOOOOOGGOK",
      ".KOGGGOOOOOGGGK.",
      ".KoOGGOOOOOGGoK.",
      "..KooOOOOOOooK..",
      "...KKooooooKK...",
      ".....KKKKKK....."] }
  };
  // One rectangle per run of same-coloured pixels in a row
  function pixels(name) {
    var ic = ICONS[name], out = "";
    ic.px.forEach(function (row, y) {
      for (var x = 0; x < row.length;) {
        var ch = row[x], n = 1;
        while (row[x + n] === ch) n++;
        if (ch !== ".") out += '<rect x="' + x + '" y="' + y + '" width="' + n + '" height="1" fill="' + ic.pal[ch] + '"/>';
        x += n;
      }
    });
    return '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">' + out + '</svg>';
  }

  // The clock in the status bar, to the minute
  function clock(el) {
    if (!el) return;
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var tick = function () { var d = new Date(); el.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()); };
    tick(); setInterval(tick, 10000);
  }

  window.ScizorDS = { pixels: pixels, clock: clock };
})();
