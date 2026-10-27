/* Draws the Pokémon Rumble Scizor models (data/models.js, made by tools/make-models.ps1) two ways:
   - as flat-coloured triangles (SVG): the posed model is turned towards the camera, lit, projected, its
     hidden faces dropped and the rest sorted back to front (shown while the smooth one loads, or instead of
     it where WebGL isn't available);
   - finished, as a smooth, textured, glossy model like in the games (WebGL), lined up exactly with the
     triangles so one can fade into the other.
   Used by the language pages (js/language.js). */
(function () {
  "use strict";
  var DATA = window.SCIZOR_MODELS;
  if (!DATA) return;
  var VIEW = 1000;

  // ------------------------------------------------------------ which Scizor each language gets
  // Every visit deals each language its own Scizor: normal or Mega on an even chance, and shiny on a 1 in 4
  // chance. Every one faces right, turned three-quarters like in the games, seen from the same angle. The picks
  // are kept for the visit (sessionStorage), so a language shows the same Scizor each time it's opened. Add
  // ?shiny to the address of the first page that deals them to see every Scizor shiny.
  var SHINY_CHANCE = 1 / 4, KEY = "xscizorr-looks-v4";
  function rollShiny() { return /[?&]shiny\b/.test(location.search) || Math.random() < SHINY_CHANCE; }
  function randomLook() {
    return {
      model: Math.random() < 0.5 ? "normal" : "mega",
      shiny: rollShiny(),
      mirror: false,            // facing right (true would mirror it to face left)
      yaw: 35,                  // degrees round the vertical
      pitch: 16,                // looking down on it a little, as in the games
      roll: 0,
      light: -40                // light from the upper left (degrees round the front, 0 = top)
    };
  }
  function save(looks) { try { sessionStorage.setItem(KEY, JSON.stringify(looks)); } catch (e) {} }
  function plan(n, fresh) {
    var saved = null;
    if (!fresh) try { saved = JSON.parse(sessionStorage.getItem(KEY)); } catch (e) {}
    if (saved && saved.length >= n) return saved;
    var looks = [];
    for (var i = 0; i < n; i++) looks.push(randomLook());
    save(looks);
    return looks;
  }

  // ------------------------------------------------------------ drawing
  var models = {};
  function model(name) {
    if (models[name]) return models[name];
    var d = DATA[name], n = d.n, c = new Uint8Array(n * 3), s = new Uint8Array(n * 3), l = new Uint8Array(n);
    for (var i = 0; i < n * 3; i++) { c[i] = parseInt(d.c.substr(i * 2, 2), 16); s[i] = parseInt(d.s.substr(i * 2, 2), 16); }
    for (i = 0; i < n; i++) l[i] = d.l ? +d.l.charAt(i) : 0;
    return (models[name] = { n: n, t: new Float32Array(d.t), c: c, s: s, l: l });
  }

  function norm(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

  var D = 3.2; // camera distance, for a little perspective
  // How a look turns the model towards the camera (the camera looks along -z, with y up)
  function turner(L) {
    var rad = Math.PI / 180, mir = L.mirror ? -1 : 1, cy = Math.cos(L.yaw * rad), sy = Math.sin(L.yaw * rad), cp = Math.cos(L.pitch * rad), sp = Math.sin(L.pitch * rad), cr = Math.cos(L.roll * rad), sr = Math.sin(L.roll * rad);
    return function (x, y, z) {
      x *= mir;
      var x1 = x * cy + z * sy, z1 = -x * sy + z * cy;          // yaw (round the vertical)
      var y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;          // pitch: the top tips towards you, so you look down on it
      return [x1 * cr - y2 * sr, x1 * sr + y2 * cr, z2];         // roll
    };
  }
  function lights(L) {
    var la = L.light * Math.PI / 180, light = norm([Math.sin(la) * 0.75, Math.cos(la) * 0.75, 0.65]);
    return { light: light, half: norm([light[0], light[1], light[2] + 1]) };
  }

  // A look drawn: visible triangles only, in screen units (0-1000), back to front.
  //   p: x,y for each corner;  c: r,g,b after lighting;  z: depth (bigger = nearer);  fit: how it was framed
  // It's framed to fill the view, unless a fit is given (e.g. to keep a turning Scizor the same size and place).
  var cache = {};
  function look(L, useFit) {
    var key = JSON.stringify(L) + (useFit ? JSON.stringify(useFit) : "");
    if (cache[key]) return cache[key];
    var m = model(L.model), base = L.shiny ? m.s : m.c, mir = L.mirror ? -1 : 1;
    var turn = turner(L), lt = lights(L), light = lt.light, half = lt.half;
    var out = [], q = [];
    for (var t = 0; t < m.n; t++) {
      for (var k = 0; k < 3; k++) q[k] = turn(m.t[t * 9 + k * 3], m.t[t * 9 + k * 3 + 1], m.t[t * 9 + k * 3 + 2]);
      var ux = q[1][0] - q[0][0], uy = q[1][1] - q[0][1], uz = q[1][2] - q[0][2], vx = q[2][0] - q[0][0], vy = q[2][1] - q[0][1], vz = q[2][2] - q[0][2];
      var nrm = norm([uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]);
      if (mir < 0) nrm = [-nrm[0], -nrm[1], -nrm[2]]; // a mirror image turns every triangle inside out
      if (nrm[2] <= 0.01) continue; // facing away
      // Bright, glossy lighting like the games: textures are lit well past their own colour, with white highlights
      var diff = Math.max(0, nrm[0] * light[0] + nrm[1] * light[1] + nrm[2] * light[2]);
      var spec = Math.pow(Math.max(0, nrm[0] * half[0] + nrm[1] * half[1] + nrm[2] * half[2]), 26) * 0.34;
      var shade = 0.7 + 0.56 * diff, rec = { p: [], c: [], z: 0 };
      if (m.l[t] === 2) { shade = 0.62 + 0.3 * diff; spec *= 0.25; } // wings: pale already, so lit gently
      for (k = 0; k < 3; k++) {
        var f = D / (D - q[k][2]);
        rec.p.push(q[k][0] * f, -q[k][1] * f);
        rec.z += q[k][2] / 3;
      }
      if (m.l[t] === 1) rec.z += 0.05; // the eyes sit on the head like stickers: paint them after the head around them
      for (k = 0; k < 3; k++) rec.c.push(Math.min(255, base[t * 3 + k] * shade + 255 * spec));
      out.push(rec);
    }
    // Fit to the frame
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    out.forEach(function (r) { for (var k = 0; k < 6; k += 2) { x0 = Math.min(x0, r.p[k]); x1 = Math.max(x1, r.p[k]); y0 = Math.min(y0, r.p[k + 1]); y1 = Math.max(y1, r.p[k + 1]); } });
    var sc = VIEW * 0.86 / Math.max(x1 - x0, y1 - y0), ox = VIEW / 2 - (x0 + x1) / 2 * sc, oy = VIEW / 2 - (y0 + y1) / 2 * sc;
    if (useFit) { sc = useFit.sc; ox = useFit.ox; oy = useFit.oy; }
    out.sort(function (a, b) { return a.z - b.z; });
    var n = out.length, res = { n: n, p: new Float32Array(n * 6), c: new Float32Array(n * 3), z: new Float32Array(n), fit: { sc: sc, ox: ox, oy: oy } };
    out.forEach(function (r, j) {
      for (var k = 0; k < 6; k += 2) { res.p[j * 6 + k] = ox + r.p[k] * sc; res.p[j * 6 + k + 1] = oy + r.p[k + 1] * sc; }
      res.c[j * 3] = r.c[0]; res.c[j * 3 + 1] = r.c[1]; res.c[j * 3 + 2] = r.c[2]; res.z[j] = r.z;
    });
    return (cache[key] = res);
  }

  function rgb(c, j) { return "rgb(" + Math.round(c[j * 3]) + "," + Math.round(c[j * 3 + 1]) + "," + Math.round(c[j * 3 + 2]) + ")"; }
  // A finished look as SVG polygons, back to front (for a still picture)
  function svg(L) {
    var lk = look(L), h = "";
    for (var j = 0; j < lk.n; j++) {
      var o = j * 6, col = rgb(lk.c, j);
      h += '<polygon points="' + lk.p[o].toFixed(1) + "," + lk.p[o + 1].toFixed(1) + " " + lk.p[o + 2].toFixed(1) + "," + lk.p[o + 3].toFixed(1) + " " + lk.p[o + 4].toFixed(1) + "," + lk.p[o + 5].toFixed(1) + '" fill="' + col + '" stroke="' + col + '"/>';
    }
    return h;
  }
  // How a look is described, e.g. "Shiny Mega Scizor"
  function name(L) { return (L.shiny ? "Shiny " : "") + (L.model === "mega" ? "Mega " : "") + "Scizor"; }

  // ------------------------------------------------------------ the finished Scizor: smooth and textured (WebGL)
  // The model with its own textures, smooth normals and glossy highlights, drawn into a canvas laid exactly
  // over the triangles (same turn, perspective and framing). Returns null where WebGL isn't available
  // (or textures can't be read, e.g. when the page is opened straight from a file); the triangles stay then.
  // pad: how far the canvas reaches past the triangles' frame on each side (as a share of it), so a turning
  // Scizor isn't clipped; the canvas must be laid out that much bigger.
  var VS = "attribute vec3 aP;attribute vec3 aN;attribute vec2 aT;uniform mat3 uM;uniform vec4 uFit;uniform vec2 uView;varying vec3 vN;varying vec2 vT;" +
    "void main(){vec3 p=uM*aP;float f=uFit.w/(uFit.w-p.z);vec2 s=vec2(uFit.y+p.x*f*uFit.x,uFit.z-p.y*f*uFit.x);" +
    "gl_Position=vec4((s.x-uView.x)/uView.y*2.0-1.0,1.0-(s.y-uView.x)/uView.y*2.0,-p.z*0.4,1.0);vN=uM*aN;vT=aT;}";
  // Same lighting as the triangles, worked out per pixel: lit well past the texture's own colour, white highlights,
  // wings lit more gently and slightly see-through
  var FS = "precision mediump float;uniform sampler2D uTex;uniform vec3 uL;uniform vec3 uH;uniform float uKind;uniform float uA;varying vec3 vN;varying vec2 vT;" +
    "void main(){vec3 n=normalize(vN);vec4 t=texture2D(uTex,vT);float d=max(dot(n,uL),0.0);float s=pow(max(dot(n,uH),0.0),26.0)*0.34;" +
    "float sh=0.7+0.56*d;if(uKind>1.5){sh=0.62+0.3*d;s*=0.25;}vec3 c=min(t.rgb*sh+s,1.0);gl_FragColor=vec4(c*uA,uA);}";
  function glView(canvas, pad) {
    var gl = null, viewLo = -(pad || 0) * VIEW, viewSize = (1 + 2 * (pad || 0)) * VIEW;
    try { gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true }); } catch (e) {}
    if (!gl) return null;
    function shader(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    var loc = {}; ["aP", "aN", "aT"].forEach(function (a) { loc[a] = gl.getAttribLocation(prog, a); });
    ["uM", "uFit", "uView", "uL", "uH", "uKind", "uA", "uTex"].forEach(function (u) { loc[u] = gl.getUniformLocation(prog, u); });
    var buffers = {}, textures = {};
    function buffer(name) {
      if (!buffers[name]) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(DATA[name].mesh.v), gl.STATIC_DRAW); buffers[name] = b; }
      return buffers[name];
    }
    function texture(url) {
      if (textures[url]) return textures[url];
      return (textures[url] = new Promise(function (res, rej) {
        var img = new Image();
        img.onload = function () {
          try {
            var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            res(t);
          } catch (e) { rej(e); }
        };
        img.onerror = rej;
        img.src = url;
      }));
    }
    // Draw look L, framed to fill the view or with the given fit, at the canvas's size on the page (or px × px
    // pixels, e.g. for a canvas that isn't on the page). Resolves true once drawn (straight away when its
    // textures are already loaded), false if it couldn't be.
    function draw(L, useFit, px) {
      var mesh = DATA[L.model] && DATA[L.model].mesh;
      if (!mesh) return Promise.resolve(false);
      var fit = useFit || look(L).fit, turn = turner(L), lt = lights(L);
      return Promise.all(mesh.groups.map(function (g) { return texture(L.shiny ? g.shiny : g.tex); })).then(function (texs) {
        var dpr = Math.min(2, window.devicePixelRatio || 1), w = px || Math.round(canvas.clientWidth * dpr) || 600, h = px || Math.round(canvas.clientHeight * dpr) || 600;
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer(L.model));
        gl.enableVertexAttribArray(loc.aP); gl.vertexAttribPointer(loc.aP, 3, gl.FLOAT, false, 32, 0);
        gl.enableVertexAttribArray(loc.aN); gl.vertexAttribPointer(loc.aN, 3, gl.FLOAT, false, 32, 12);
        gl.enableVertexAttribArray(loc.aT); gl.vertexAttribPointer(loc.aT, 2, gl.FLOAT, false, 32, 24);
        var cx = turn(1, 0, 0), cy = turn(0, 1, 0), cz = turn(0, 0, 1);
        gl.uniformMatrix3fv(loc.uM, false, cx.concat(cy, cz));
        gl.uniform4f(loc.uFit, fit.sc, fit.ox, fit.oy, D);
        gl.uniform2f(loc.uView, viewLo, viewSize);
        gl.uniform3fv(loc.uL, lt.light); gl.uniform3fv(loc.uH, lt.half);
        gl.uniform1i(loc.uTex, 0); gl.activeTexture(gl.TEXTURE0);
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
        mesh.groups.forEach(function (g, i) {
          // wings: slightly see-through, over what's behind them;  eyes: always on top of the head around them
          if (g.kind === 2) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); } else { gl.disable(gl.BLEND); gl.depthMask(true); }
          if (g.kind === 1) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -8); } else gl.disable(gl.POLYGON_OFFSET_FILL);
          gl.uniform1f(loc.uKind, g.kind); gl.uniform1f(loc.uA, g.kind === 2 ? 0.86 : 1);
          gl.bindTexture(gl.TEXTURE_2D, texs[i]);
          gl.drawArrays(gl.TRIANGLES, g.start, g.count);
        });
        return true;
      }).catch(function () { return false; });
    }
    // Load every texture (both models, normal and shiny) ahead of time, so any Scizor can be drawn straight away
    function preload() {
      Object.keys(DATA).forEach(function (name) {
        buffer(name);
        DATA[name].mesh.groups.forEach(function (g) { texture(g.tex).catch(function () {}); texture(g.shiny).catch(function () {}); });
      });
    }
    return { draw: draw, preload: preload };
  }

  window.ScizorModel = { view: VIEW, plan: plan, save: save, rollShiny: rollShiny, look: look, svg: svg, name: name, glView: glView, shinyChance: SHINY_CHANCE };
})();
