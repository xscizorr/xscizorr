/* The flag shown for each language on the Collection page, drawn as small SVGs (Windows can't show
   flag emoji). All are 3:2 and simplified so they read at a small size.
   Where a language is printed for more than one country, one flag is chosen:
   English → United States, Spanish (Latin America) → Mexico, Portuguese → Brazil,
   Traditional Chinese → China, Simplified Chinese → Taiwan. Change a line to use another. */
(function () {
  "use strict";
  function svg(body) { return '<svg viewBox="0 0 30 20" aria-hidden="true">' + body + '</svg>'; }
  function rect(x, y, w, h, fill) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '"/>'; }
  function vert(a, b, c) { return rect(0, 0, 10, 20, a) + rect(10, 0, 10, 20, b) + rect(20, 0, 10, 20, c); }
  function horiz(a, b, c) { return rect(0, 0, 30, 6.67, a) + rect(0, 6.67, 30, 6.67, b) + rect(0, 13.33, 30, 6.67, c); }
  // A star with n points, outer radius R and inner radius r, pointing up
  function star(cx, cy, R, r, n, fill) {
    var p = [];
    for (var i = 0; i < n * 2; i++) {
      var a = -Math.PI / 2 + i * Math.PI / n, rad = i % 2 ? r : R;
      p.push((cx + rad * Math.cos(a)).toFixed(2) + "," + (cy + rad * Math.sin(a)).toFixed(2));
    }
    return '<polygon points="' + p.join(" ") + '" fill="' + fill + '"/>';
  }
  // One of the four trigrams on the Korean flag: three bars (true = whole, false = broken), turned to face the middle
  function trigram(cx, cy, deg, bars) {
    var out = "";
    bars.forEach(function (whole, k) {
      var y = -1.1 + k * 1.1;
      out += whole ? rect(-1.9, y - .35, 3.8, .7, "#000") : rect(-1.9, y - .35, 1.6, .7, "#000") + rect(.3, y - .35, 1.6, .7, "#000");
    });
    return '<g transform="translate(' + cx + ' ' + cy + ') rotate(' + deg + ')">' + out + '</g>';
  }

  window.SCIZOR_FLAGS = {
    EN: svg((function () {
      // 13 stripes, and 50 stars in the blue corner (rows of 6 and 5, staggered)
      var h = 20 / 13, out = rect(0, 0, 30, 20, "#B22234");
      for (var k = 1; k < 13; k += 2) out += rect(0, k * h, 30, h, "#fff");
      out += rect(0, 0, 12, 7 * h, "#3C3B6E");
      for (var r = 0; r < 9; r++) for (var c = 0; c < (r % 2 ? 5 : 6); c++)
        out += '<circle cx="' + (1 + c * 2 + (r % 2)).toFixed(2) + '" cy="' + (0.6 + r * (7 * h - 1.2) / 8).toFixed(2) + '" r=".36" fill="#fff"/>';
      return out;
    })()),
    JA: svg(rect(0, 0, 30, 20, "#fff") + '<circle cx="15" cy="10" r="6" fill="#BC002D"/>'),
    FR: svg(vert("#002395", "#fff", "#ED2939")),
    DE: svg(horiz("#000", "#DD0000", "#FFCE00")),
    IT: svg(vert("#009246", "#fff", "#CE2B37")),
    ES: svg(rect(0, 0, 30, 20, "#AA151B") + rect(0, 5, 30, 10, "#F1BF00")),
    LA: svg(vert("#006847", "#fff", "#CE1126") + '<circle cx="15" cy="10" r="2.7" fill="none" stroke="#006847" stroke-width=".7"/><ellipse cx="15" cy="9.6" rx="1.4" ry="1.8" fill="#8C5A2B"/>'),
    PT: svg(rect(0, 0, 30, 20, "#009C3B") + '<path d="M15,2.2L27.6,10L15,17.8L2.4,10Z" fill="#FFDF00"/><circle cx="15" cy="10" r="4.4" fill="#002776"/>' +
      '<path d="M10.8,9.2Q15,8.3 19.2,10.9" stroke="#fff" stroke-width=".8" fill="none"/>'),
    KO: svg(rect(0, 0, 30, 20, "#fff") +
      '<g transform="rotate(33.69 15 10)"><circle cx="15" cy="10" r="5" fill="#003478"/><path d="M10,10A5,5 0 0 1 20,10A2.5,2.5 0 0 1 15,10A2.5,2.5 0 0 0 10,10Z" fill="#CD2E3A"/></g>' +
      trigram(7.2, 4.8, -56.31, [true, true, true]) + trigram(22.8, 15.2, -56.31, [false, false, false]) +
      trigram(22.8, 4.8, 56.31, [false, true, false]) + trigram(7.2, 15.2, 56.31, [true, false, true])),
    ZS: svg(rect(0, 0, 30, 20, "#FE0000") + rect(0, 0, 15, 10, "#000095") + star(7.5, 5, 3.75, 2.1, 12, "#fff") +
      '<circle cx="7.5" cy="5" r="1.9" fill="#000095"/><circle cx="7.5" cy="5" r="1.6" fill="#fff"/>'),
    ZT: svg(rect(0, 0, 30, 20, "#EE1C25") + star(5, 5, 3, 1.15, 5, "#FFFF00") +
      star(10, 2, 1, .38, 5, "#FFFF00") + star(12, 4, 1, .38, 5, "#FFFF00") + star(12, 7, 1, .38, 5, "#FFFF00") + star(10, 9, 1, .38, 5, "#FFFF00")),
    ID: svg(rect(0, 0, 30, 10, "#CE1126") + rect(0, 10, 30, 10, "#fff")),
    TH: svg(rect(0, 0, 30, 20, "#A51931") + rect(0, 3.33, 30, 13.34, "#F4F5F8") + rect(0, 6.67, 30, 6.66, "#2D2A4A")),
    PL: svg(rect(0, 0, 30, 10, "#fff") + rect(0, 10, 30, 10, "#DC143C")),
    RU: svg(horiz("#fff", "#0039A6", "#D52B1E"))
  };
})();
