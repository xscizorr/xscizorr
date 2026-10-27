<#
  Turns the Pokémon Rumble Scizor models (normal and Mega) into triangles for the website.

    powershell -ExecutionPolicy Bypass -File tools\make-models.ps1

  Reads assets/models/normal and assets/models/mega (each an .obj with its textures, and a .dae with its
  skeleton) and writes data/models.js. The model is first posed with its skeleton, like Scizor stands in
  the games: the far claw held out, the near one in front of the chest (see $POSES below). Every triangle
  is kept, with its colour taken from the texture. Triangles that carry detail in the texture (the eyes,
  the markings, the lines on the wings) are split into smaller triangles so the detail survives. Each
  triangle also gets its shiny colour: from the *_C textures where the model has them, otherwise worked
  out from how the normal model's colours change in its shiny textures.
  The page (js/scizor-model.js) then lights, turns and draws the model.
#>
# How much colour variation inside a triangle makes it split (lower = more, smaller triangles)
param([double]$Detail = 700)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# The pose: how far each joint turns from the model's resting position, as yaw (round the vertical),
# pitch (tip forward) and roll (tilt), in degrees. Both arms hang from one ARM joint, so they turn together.
$POSES = @{ normal = 'ARM:28,0,-6'; mega = 'ARM:26,0,-4' }

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing, System.Xml -TypeDefinition @'
using System;
using System.Xml;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public class Tex {
  public int W, H; public byte[] P; // RGBA
  public Tex(string path) {
    using (var b = new Bitmap(path)) {
      W = b.Width; H = b.Height; P = new byte[W * H * 4];
      var d = b.LockBits(new Rectangle(0, 0, W, H), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      var raw = new byte[d.Stride * H]; Marshal.Copy(d.Scan0, raw, 0, raw.Length); b.UnlockBits(d);
      for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) {
        int s = y * d.Stride + x * 4, t = (y * W + x) * 4;
        P[t] = raw[s + 2]; P[t + 1] = raw[s + 1]; P[t + 2] = raw[s]; P[t + 3] = raw[s + 3];
      }
    }
  }
  public Tex(int w, int h) { W = w; H = h; P = new byte[w * h * 4]; }
}

public static class ModelMaker {
  static CultureInfo inv = CultureInfo.InvariantCulture;

  // A shiny texture for a model that has none: each pixel takes the shiny version of the nearest colour
  // in the normal model's textures, keeping its own small differences in shade.
  public static Tex MakeShiny(Tex src, Tex[] normals, Tex[] shinies) {
    var keys = new List<int[]>(); var seen = new HashSet<int>();
    for (int k = 0; k < normals.Length; k++) {
      Tex a = normals[k], b = shinies[k];
      for (int i = 0; i < a.W * a.H; i++) {
        int q = ((a.P[i * 4] >> 3) << 10) | ((a.P[i * 4 + 1] >> 3) << 5) | (a.P[i * 4 + 2] >> 3);
        if (!seen.Add(q)) continue;
        keys.Add(new int[] { a.P[i * 4], a.P[i * 4 + 1], a.P[i * 4 + 2], b.P[i * 4], b.P[i * 4 + 1], b.P[i * 4 + 2] });
      }
    }
    var o = new Tex(src.W, src.H);
    for (int i = 0; i < src.W * src.H; i++) {
      int r = src.P[i * 4], g = src.P[i * 4 + 1], bl = src.P[i * 4 + 2];
      int best = 0; long bd = long.MaxValue;
      for (int k = 0; k < keys.Count; k++) {
        long dr = r - keys[k][0], dg = g - keys[k][1], db = bl - keys[k][2], d = dr * dr * 3 + dg * dg * 4 + db * db * 2;
        if (d < bd) { bd = d; best = k; }
      }
      var m = keys[best];
      o.P[i * 4] = Clamp(m[3] + (r - m[0]) * 0.6); o.P[i * 4 + 1] = Clamp(m[4] + (g - m[1]) * 0.6); o.P[i * 4 + 2] = Clamp(m[5] + (bl - m[2]) * 0.6); o.P[i * 4 + 3] = src.P[i * 4 + 3];
    }
    return o;
  }
  static byte Clamp(double v) { return (byte)Math.Max(0, Math.Min(255, Math.Round(v))); }

  // Poses the model with its skeleton (.dae): every vertex follows the joints it's weighted to, turned round
  // each joint's position. pose is "JOINT:yaw,pitch,roll;..." in degrees. The joints only move, never turn,
  // in these models' resting pose, so their positions are the sums of their parents' offsets.
  static readonly char[] WS = { ' ', '\t', '\r', '\n' };
  static Dictionary<string, double>[] poseW;      // the last posed model's joint weights per vertex
  static Dictionary<string, double[]> poseTurns;  // and how far each joint turned
  static List<double[]> Pose(string daePath, List<double[]> V, string pose) {
    var turns = new Dictionary<string, double[]>();
    foreach (var part in (pose ?? "").Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries)) {
      var kv = part.Split(':'); var a = kv[1].Split(',');
      turns[kv[0].Trim()] = new[] { D(a[0]), D(a[1]), D(a[2]) };
    }
    poseW = null; poseTurns = turns;
    if (turns.Count == 0 || daePath == null || !File.Exists(daePath)) return V;
    var doc = new XmlDocument(); doc.Load(daePath);
    var ns = new XmlNamespaceManager(doc.NameTable); ns.AddNamespace("c", doc.DocumentElement.NamespaceURI);
    var joints = new Dictionary<string, double[]>();
    Walk(doc.SelectSingleNode("//c:library_visual_scenes/c:visual_scene", ns), new double[3], ns, joints);
    var W = new Dictionary<string, double>[V.Count];
    foreach (XmlNode skin in doc.SelectNodes("//c:library_controllers/c:controller/c:skin", ns)) {
      var geo = doc.SelectSingleNode("//c:geometry[@id='" + skin.Attributes["source"].Value.Substring(1) + "']", ns);
      var posIn = geo.SelectSingleNode(".//c:vertices/c:input[@semantic='POSITION']", ns);
      double[] pa = Nums(geo.SelectSingleNode(".//c:source[@id='" + posIn.Attributes["source"].Value.Substring(1) + "']/c:float_array", ns).InnerText);
      string[] names = skin.SelectSingleNode(".//c:Name_array", ns).InnerText.Split(WS, StringSplitOptions.RemoveEmptyEntries);
      var vw = skin.SelectSingleNode("c:vertex_weights", ns);
      int jo = 0, wo = 0, stride = 0; string wsrc = "";
      foreach (XmlNode inp in vw.SelectNodes("c:input", ns)) {
        int off = int.Parse(inp.Attributes["offset"].Value); stride = Math.Max(stride, off + 1);
        if (inp.Attributes["semantic"].Value == "JOINT") jo = off;
        if (inp.Attributes["semantic"].Value == "WEIGHT") { wo = off; wsrc = inp.Attributes["source"].Value.Substring(1); }
      }
      double[] wts = Nums(skin.SelectSingleNode(".//c:source[@id='" + wsrc + "']/c:float_array", ns).InnerText);
      double[] vc = Nums(vw.SelectSingleNode("c:vcount", ns).InnerText), vv = Nums(vw.SelectSingleNode("c:v", ns).InnerText);
      int ptr = 0;
      for (int vi = 0; vi < vc.Length; vi++) {
        // The .dae and .obj list the same points (in a different order): match them by position
        int oi = -1;
        for (int k = 0; k < V.Count && oi < 0; k++)
          if (Math.Abs(V[k][0] - pa[vi * 3]) + Math.Abs(V[k][1] - pa[vi * 3 + 1]) + Math.Abs(V[k][2] - pa[vi * 3 + 2]) < 1e-5) oi = k;
        var w = new Dictionary<string, double>();
        for (int k = 0; k < (int)vc[vi]; k++) {
          string jn = names[(int)vv[ptr + jo]]; double wt = wts[(int)vv[ptr + wo]];
          w[jn] = (w.ContainsKey(jn) ? w[jn] : 0) + wt; ptr += stride;
        }
        if (oi >= 0 && W[oi] == null) W[oi] = w;
      }
    }
    poseW = W;
    var outV = new List<double[]>();
    for (int i = 0; i < V.Count; i++) {
      var w = W[i]; double[] o = new double[3]; double tot = 0;
      if (w == null) { outV.Add(V[i]); continue; }
      foreach (var kv in w) {
        double[] q = V[i], t;
        if (turns.TryGetValue(kv.Key, out t) && joints.ContainsKey(kv.Key)) q = Turn(q, joints[kv.Key], t);
        for (int k = 0; k < 3; k++) o[k] += q[k] * kv.Value;
        tot += kv.Value;
      }
      outV.Add(tot > 0 ? new[] { o[0] / tot, o[1] / tot, o[2] / tot } : V[i]);
    }
    return outV;
  }
  // A vertex normal turned the same way as its vertex was posed
  static double[] PoseNormal(int vi, double[] n) {
    var w = poseW == null ? null : poseW[vi];
    if (w == null) return n;
    double[] o = new double[3], zero = new double[3];
    foreach (var kv in w) {
      double[] q = n, t;
      if (poseTurns.TryGetValue(kv.Key, out t)) q = Turn(n, zero, t);
      for (int k = 0; k < 3; k++) o[k] += q[k] * kv.Value;
    }
    double l = Math.Sqrt(o[0] * o[0] + o[1] * o[1] + o[2] * o[2]);
    return l > 0 ? new[] { o[0] / l, o[1] / l, o[2] / l } : n;
  }
  public static void Save(Tex t, string path) {
    using (var b = new Bitmap(t.W, t.H, PixelFormat.Format32bppArgb)) {
      for (int y = 0; y < t.H; y++) for (int x = 0; x < t.W; x++) {
        int i = (y * t.W + x) * 4; b.SetPixel(x, y, Color.FromArgb(t.P[i + 3], t.P[i], t.P[i + 1], t.P[i + 2]));
      }
      b.Save(path, ImageFormat.Png);
    }
  }
  static void Walk(XmlNode n, double[] at, XmlNamespaceManager ns, Dictionary<string, double[]> joints) {
    foreach (XmlNode c in n.SelectNodes("c:node", ns)) {
      var p = (double[])at.Clone(); var m = c.SelectSingleNode("c:matrix", ns);
      if (m != null) { var a = Nums(m.InnerText); p[0] += a[3]; p[1] += a[7]; p[2] += a[11]; }
      if (c.Attributes["type"] != null && c.Attributes["type"].Value == "JOINT" && c.Attributes["name"] != null) joints[c.Attributes["name"].Value] = p;
      Walk(c, p, ns, joints);
    }
  }
  // Turn point v round pivot p: yaw (round the vertical), then pitch, then roll, in degrees
  static double[] Turn(double[] v, double[] p, double[] a) {
    double r = Math.PI / 180, y = a[0] * r, x = a[1] * r, z = a[2] * r;
    double px = v[0] - p[0], py = v[1] - p[1], pz = v[2] - p[2];
    double x1 = px * Math.Cos(y) + pz * Math.Sin(y), z1 = -px * Math.Sin(y) + pz * Math.Cos(y);
    double y2 = py * Math.Cos(x) - z1 * Math.Sin(x), z2 = py * Math.Sin(x) + z1 * Math.Cos(x);
    double x3 = x1 * Math.Cos(z) - y2 * Math.Sin(z), y3 = x1 * Math.Sin(z) + y2 * Math.Cos(z);
    return new[] { x3 + p[0], y3 + p[1], z2 + p[2] };
  }
  static double[] Nums(string s) {
    var parts = s.Split(WS, StringSplitOptions.RemoveEmptyEntries); var o = new double[parts.Length];
    for (int i = 0; i < parts.Length; i++) o[i] = D(parts[i]);
    return o;
  }

  // Reads an .obj and returns it as JS: the flat triangles (positions normalised, colours and shiny
  // colours) for the pieces, and the smooth mesh (positions, normals, texture coordinates and textures)
  // for the finished Scizor
  public static string Convert(string objPath, string daePath, string pose, Dictionary<string, Tex> texNormal, Dictionary<string, Tex> texShiny,
                               Dictionary<string, string> pathNormal, Dictionary<string, string> pathShiny, Dictionary<string, int> depthFor, double detail) {
    var V = new List<double[]>(); var T = new List<double[]>(); var N = new List<double[]>();
    var faces = new List<int[]>(); var faceMat = new List<string>(); string mat = "";
    foreach (var raw in File.ReadAllLines(objPath)) {
      var line = raw.Trim(); if (line.Length == 0 || line[0] == '#') continue;
      var p = line.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
      if (p[0] == "v") V.Add(new[] { D(p[1]), D(p[2]), D(p[3]) });
      else if (p[0] == "vt") T.Add(new[] { D(p[1]), D(p[2]) });
      else if (p[0] == "vn") N.Add(new[] { D(p[1]), D(p[2]), D(p[3]) });
      else if (p[0] == "usemtl") mat = p[1];
      else if (p[0] == "f") {
        var idx = new List<int[]>();
        for (int k = 1; k < p.Length; k++) {
          var s = p[k].Split('/');
          idx.Add(new[] { int.Parse(s[0]) - 1, s.Length > 1 && s[1] != "" ? int.Parse(s[1]) - 1 : -1, s.Length > 2 && s[2] != "" ? int.Parse(s[2]) - 1 : -1 });
        }
        for (int k = 1; k + 1 < idx.Count; k++) { faces.Add(new[] { idx[0][0], idx[0][1], idx[0][2], idx[k][0], idx[k][1], idx[k][2], idx[k + 1][0], idx[k + 1][1], idx[k + 1][2] }); faceMat.Add(mat); }
      }
    }
    var PV = Pose(daePath, V, pose);
    // Normalise: centre the posed model and make its tallest side 1
    double[] lo = { 1e9, 1e9, 1e9 }, hi = { -1e9, -1e9, -1e9 };
    foreach (var v in PV) for (int k = 0; k < 3; k++) { lo[k] = Math.Min(lo[k], v[k]); hi[k] = Math.Max(hi[k], v[k]); }
    double size = Math.Max(hi[0] - lo[0], Math.Max(hi[1] - lo[1], hi[2] - lo[2]));
    var outP = new StringBuilder(); var outC = new StringBuilder(); var outS = new StringBuilder(); var outL = new StringBuilder(); int count = 0;
    for (int f = 0; f < faces.Count; f++) {
      var F = faces[f];
      int[] order = { 0, 1, 2 };
      // Wind every triangle the same way as its vertex normals (in the resting pose, which the normals
      // belong to), so the page can tell front from back
      if (F[2] >= 0) {
        double[] nn = { 0, 0, 0 }; for (int k = 0; k < 3; k++) { var n = N[F[k * 3 + 2]]; nn[0] += n[0]; nn[1] += n[1]; nn[2] += n[2]; }
        double[] cr = Cross(Sub(V[F[3]], V[F[0]]), Sub(V[F[6]], V[F[0]]));
        if (cr[0] * nn[0] + cr[1] * nn[1] + cr[2] * nn[2] < 0) order = new[] { 0, 2, 1 };
      }
      double[][] P = new double[3][], U = new double[3][];
      for (int k = 0; k < 3; k++) {
        int c = order[k]; var v = PV[F[c * 3]];
        P[k] = new[] { (v[0] - (lo[0] + hi[0]) / 2) / size, (v[1] - (lo[1] + hi[1]) / 2) / size, (v[2] - (lo[2] + hi[2]) / 2) / size };
        U[k] = F[c * 3 + 1] >= 0 ? T[F[c * 3 + 1]] : new[] { 0.0, 0.0 };
      }
      Tex tn, ts; texNormal.TryGetValue(faceMat[f], out tn); texShiny.TryGetValue(faceMat[f], out ts);
      int depth; if (!depthFor.TryGetValue(faceMat[f], out depth)) depth = 2;
      // Marks for the page: 1 = eye (drawn on top of the head like a sticker, so painted last),
      // 2 = wing (pale and see-through in the games, so lit more gently)
      char layer = faceMat[f].IndexOf("EYE", StringComparison.OrdinalIgnoreCase) >= 0 ? '1' : faceMat[f].IndexOf("wing", StringComparison.OrdinalIgnoreCase) >= 0 ? '2' : '0';
      Emit(P, U, tn, ts ?? tn, depth, detail, layer, outP, outC, outS, outL, ref count);
    }

    // The smooth mesh: every corner with its posed position and normal and its texture coordinate,
    // grouped by material (body first, then wings, then the eyes, which are drawn last)
    var groups = new Dictionary<string, List<double>>();
    for (int f = 0; f < faces.Count; f++) {
      var F = faces[f]; List<double> g;
      if (!groups.TryGetValue(faceMat[f], out g)) groups[faceMat[f]] = g = new List<double>();
      double[] fn = Cross(Sub(PV[F[3]], PV[F[0]]), Sub(PV[F[6]], PV[F[0]]));
      for (int k = 0; k < 3; k++) {
        int vi = F[k * 3]; var v = PV[vi];
        double[] n = F[k * 3 + 2] >= 0 ? PoseNormal(vi, N[F[k * 3 + 2]]) : fn;
        double[] uv = F[k * 3 + 1] >= 0 ? T[F[k * 3 + 1]] : new[] { 0.0, 0.0 };
        g.Add((v[0] - (lo[0] + hi[0]) / 2) / size); g.Add((v[1] - (lo[1] + hi[1]) / 2) / size); g.Add((v[2] - (lo[2] + hi[2]) / 2) / size);
        g.Add(n[0]); g.Add(n[1]); g.Add(n[2]); g.Add(uv[0]); g.Add(1 - uv[1]);
      }
    }
    var mats = new List<string>(groups.Keys);
    Func<string, int> kind = m => m.IndexOf("EYE", StringComparison.OrdinalIgnoreCase) >= 0 ? 1 : m.IndexOf("wing", StringComparison.OrdinalIgnoreCase) >= 0 ? 2 : 0;
    Func<int, int> drawOrder = k => k == 0 ? 0 : k == 2 ? 1 : 2;
    mats.Sort((a, b) => drawOrder(kind(a)).CompareTo(drawOrder(kind(b))));
    var mesh = new StringBuilder(); var vals = new StringBuilder(); int start = 0;
    foreach (var m in mats) {
      var g = groups[m]; int corners = g.Count / 8;
      foreach (var x in g) { if (vals.Length > 0) vals.Append(','); vals.Append(Math.Round(x, 4).ToString(inv)); }
      string pn, ps; pathNormal.TryGetValue(m, out pn); pathShiny.TryGetValue(m, out ps);
      if (mesh.Length > 0) mesh.Append(',');
      mesh.Append("{\"kind\":" + kind(m) + ",\"start\":" + start + ",\"count\":" + corners + ",\"tex\":\"" + (pn ?? "") + "\",\"shiny\":\"" + (ps ?? pn ?? "") + "\"}");
      start += corners;
    }
    return "{\"n\":" + count + ",\"t\":[" + outP + "],\"c\":\"" + outC + "\",\"s\":\"" + outS + "\",\"l\":\"" + outL + "\"," +
      "\"mesh\":{\"v\":[" + vals + "],\"groups\":[" + mesh + "]}}";
  }

  // Colour a triangle from its patch of texture; where that patch has detail, split it into four and try again
  static void Emit(double[][] P, double[][] U, Tex tn, Tex ts, int depth, double detail, char layer, StringBuilder op, StringBuilder oc, StringBuilder os, StringBuilder ol, ref int count) {
    double[] mn, ms; double var = Stats(U, tn, ts, out mn, out ms);
    double area = tn == null ? 0 : Math.Abs((U[1][0] - U[0][0]) * (U[2][1] - U[0][1]) - (U[2][0] - U[0][0]) * (U[1][1] - U[0][1])) * tn.W * tn.H / 2;
    if (depth > 0 && var > detail && area > 3) {
      double[][] pm = { Mid(P[0], P[1]), Mid(P[1], P[2]), Mid(P[2], P[0]) }, um = { Mid(U[0], U[1]), Mid(U[1], U[2]), Mid(U[2], U[0]) };
      Emit(new[] { P[0], pm[0], pm[2] }, new[] { U[0], um[0], um[2] }, tn, ts, depth - 1, detail, layer, op, oc, os, ol, ref count);
      Emit(new[] { pm[0], P[1], pm[1] }, new[] { um[0], U[1], um[1] }, tn, ts, depth - 1, detail, layer, op, oc, os, ol, ref count);
      Emit(new[] { pm[2], pm[1], P[2] }, new[] { um[2], um[1], U[2] }, tn, ts, depth - 1, detail, layer, op, oc, os, ol, ref count);
      Emit(new[] { pm[0], pm[1], pm[2] }, new[] { um[0], um[1], um[2] }, tn, ts, depth - 1, detail, layer, op, oc, os, ol, ref count);
      return;
    }
    for (int k = 0; k < 3; k++) for (int a = 0; a < 3; a++) { if (op.Length > 0) op.Append(','); op.Append(Math.Round(P[k][a], 4).ToString(inv)); }
    oc.Append(Hex(mn)); os.Append(Hex(ms)); ol.Append(layer); count++;
  }
  static string Hex(double[] c) { return ((int)c[0]).ToString("x2") + ((int)c[1]).ToString("x2") + ((int)c[2]).ToString("x2"); }

  // Average colour (normal and shiny) of the texture inside a UV triangle, and how much it varies
  static double Stats(double[][] U, Tex tn, Tex ts, out double[] mn, out double[] ms) {
    mn = new double[] { 200, 40, 50 }; ms = new double[] { 140, 140, 20 };
    if (tn == null) return 0;
    // Texture coordinates can run past the edges (the texture repeats); pixels are wrapped when read
    double[] px = new double[6];
    for (int k = 0; k < 3; k++) { px[k * 2] = U[k][0] * tn.W; px[k * 2 + 1] = (1 - U[k][1]) * tn.H; }
    double x0 = Math.Min(px[0], Math.Min(px[2], px[4])), x1 = Math.Max(px[0], Math.Max(px[2], px[4]));
    double y0 = Math.Min(px[1], Math.Min(px[3], px[5])), y1 = Math.Max(px[1], Math.Max(px[3], px[5]));
    double[] s = new double[3], s2 = new double[3], sh = new double[3]; int n = 0;
    for (int y = (int)Math.Floor(y0); y <= (int)Math.Ceiling(y1); y++) for (int x = (int)Math.Floor(x0); x <= (int)Math.Ceiling(x1); x++) {
      if (!In(x + .5, y + .5, px) || Alpha(tn, x, y) < 100) continue; // see-through pixels don't count
      Add(tn, ts, x, y, s, s2, sh); n++;
    }
    if (n == 0) { // too small to cover a pixel: use the pixel under its middle
      int cx = (int)Math.Floor((px[0] + px[2] + px[4]) / 3), cy = (int)Math.Floor((px[1] + px[3] + px[5]) / 3);
      Add(tn, ts, cx, cy, s, s2, sh); n = 1;
    }
    mn = new[] { s[0] / n, s[1] / n, s[2] / n }; ms = new[] { sh[0] / n, sh[1] / n, sh[2] / n };
    double v = 0; for (int k = 0; k < 3; k++) v += s2[k] / n - mn[k] * mn[k];
    return v / 3;
  }
  static int Alpha(Tex t, int x, int y) { int ix = ((x % t.W) + t.W) % t.W, iy = ((y % t.H) + t.H) % t.H; return t.P[(iy * t.W + ix) * 4 + 3]; }
  static void Add(Tex tn, Tex ts, int x, int y, double[] s, double[] s2, double[] sh) {
    int ix = ((x % tn.W) + tn.W) % tn.W, iy = ((y % tn.H) + tn.H) % tn.H, i = (iy * tn.W + ix) * 4;
    for (int k = 0; k < 3; k++) { s[k] += tn.P[i + k]; s2[k] += tn.P[i + k] * tn.P[i + k]; }
    int jx = ix * ts.W / tn.W, jy = iy * ts.H / tn.H, j = (jy * ts.W + jx) * 4;
    for (int k = 0; k < 3; k++) sh[k] += ts.P[j + k];
  }
  static bool In(double x, double y, double[] p) {
    double d1 = (x - p[2]) * (p[1] - p[3]) - (p[0] - p[2]) * (y - p[3]);
    double d2 = (x - p[4]) * (p[3] - p[5]) - (p[2] - p[4]) * (y - p[5]);
    double d3 = (x - p[0]) * (p[5] - p[1]) - (p[4] - p[0]) * (y - p[1]);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  }
  static double D(string s) { return double.Parse(s, inv); }
  static double[] Sub(double[] a, double[] b) { return new[] { a[0] - b[0], a[1] - b[1], a[2] - b[2] }; }
  static double[] Cross(double[] a, double[] b) { return new[] { a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0] }; }
  static double[] Mid(double[] a, double[] b) { var r = new double[a.Length]; for (int k = 0; k < a.Length; k++) r[k] = (a[k] + b[k]) / 2; return r; }
}
'@

function Read-Mtl($objPath) {
  $dir = Split-Path $objPath
  $mtl = Get-ChildItem -LiteralPath $dir -Filter *.mtl | Select-Object -First 1
  $map = @{}; $cur = $null
  foreach ($l in Get-Content -LiteralPath $mtl.FullName) {
    $t = $l.Trim()
    if ($t -match '^newmtl\s+(\S+)') { $cur = $Matches[1] }
    elseif ($t -match '^map_Kd\s+(.+)$' -and $cur) { $map[$cur] = Join-Path $dir ($Matches[1].Trim() -replace '^\./', '') }
  }
  return $map
}

$out = New-Object System.Text.StringBuilder
[void]$out.Append("// Made by tools/make-models.ps1 from the Pokémon Rumble Scizor models in assets/models. Re-run that script to change it.`n")
[void]$out.Append("window.SCIZOR_MODELS = {")
$depth = New-Object 'System.Collections.Generic.Dictionary[string,int]'
# How many times a triangle may be split (each split makes four): most for the eyes
$depth['TEX_ANIM_EYE_mat_id'] = 3; $depth['mat_body_mat_id'] = 2; $depth['mat_wing_mat_id'] = 1

# Texture paths as the website sees them (from the site's folder, with forward slashes)
function Site-Path($p) { return ($p.Substring($root.Length + 1) -replace '\\', '/') }

# Normal Scizor, with its own shiny (_C) textures
$nObj = (Get-ChildItem (Join-Path $root 'assets\models\normal') -Filter *.obj | Select-Object -First 1).FullName
$nMtl = Read-Mtl $nObj
$texN = New-Object 'System.Collections.Generic.Dictionary[string,Tex]'; $texS = New-Object 'System.Collections.Generic.Dictionary[string,Tex]'
$pathN = New-Object 'System.Collections.Generic.Dictionary[string,string]'; $pathS = New-Object 'System.Collections.Generic.Dictionary[string,string]'
$pairsN = @(); $pairsS = @()
foreach ($k in $nMtl.Keys) {
  $texN[$k] = New-Object Tex($nMtl[$k]); $pathN[$k] = Site-Path $nMtl[$k]
  $shinyPath = $nMtl[$k] -replace '\.png$', '_C.png'
  if (Test-Path -LiteralPath $shinyPath) { $texS[$k] = New-Object Tex($shinyPath); $pathS[$k] = Site-Path $shinyPath; $pairsN += $texN[$k]; $pairsS += $texS[$k] }
}
$nDae = (Get-ChildItem (Join-Path $root 'assets\models\normal') -Filter *.dae | Select-Object -First 1).FullName
$js = [ModelMaker]::Convert($nObj, $nDae, $POSES.normal, $texN, $texS, $pathN, $pathS, $depth, $Detail)
[void]$out.Append("`n`"normal`":" + $js + ",")
Write-Host ("normal: {0} triangles" -f ([regex]::Match($js, '"n":(\d+)').Groups[1].Value))

# Mega Scizor: no shiny textures came with it, so they're worked out from the normal model's and saved
# next to its own textures as *_C.png (delete those to work them out again)
$mObj = (Get-ChildItem (Join-Path $root 'assets\models\mega') -Filter *.obj | Select-Object -First 1).FullName
$mMtl = Read-Mtl $mObj
$texN = New-Object 'System.Collections.Generic.Dictionary[string,Tex]'; $texS = New-Object 'System.Collections.Generic.Dictionary[string,Tex]'
$pathN = New-Object 'System.Collections.Generic.Dictionary[string,string]'; $pathS = New-Object 'System.Collections.Generic.Dictionary[string,string]'
foreach ($k in $mMtl.Keys) {
  $texN[$k] = New-Object Tex($mMtl[$k]); $pathN[$k] = Site-Path $mMtl[$k]
  $shinyPath = $mMtl[$k] -replace '\.png$', '_C.png'
  if (-not (Test-Path -LiteralPath $shinyPath)) { [ModelMaker]::Save([ModelMaker]::MakeShiny($texN[$k], [Tex[]]$pairsN, [Tex[]]$pairsS), $shinyPath) }
  $texS[$k] = New-Object Tex($shinyPath); $pathS[$k] = Site-Path $shinyPath
}
$mDae = (Get-ChildItem (Join-Path $root 'assets\models\mega') -Filter *.dae | Select-Object -First 1).FullName
$js = [ModelMaker]::Convert($mObj, $mDae, $POSES.mega, $texN, $texS, $pathN, $pathS, $depth, $Detail)
[void]$out.Append("`n`"mega`":" + $js + "`n};`n")
Write-Host ("mega: {0} triangles" -f ([regex]::Match($js, '"n":(\d+)').Groups[1].Value))

$dest = Join-Path $root 'data\models.js'
[IO.File]::WriteAllText($dest, $out.ToString(), (New-Object Text.UTF8Encoding($false)))
Write-Host ("Wrote {0} ({1:N0} KB)" -f $dest, ((Get-Item $dest).Length / 1KB))
