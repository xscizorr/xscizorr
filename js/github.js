/* Editing from the live site: your edits are saved into the site's card list (data/cards.js) in its GitHub
   repository, and GitHub Pages publishes it again, so everyone sees them a minute or two later. No uploading.

   Connect each browser you edit in once: open a language page with ?owner on the end of its address (e.g.
   language.html?lang=JA&owner) and paste a GitHub access key that can change that one repository. The key is kept
   in that browser only; visitors never see any of this. Setting it up is in the README, under "Editing from the
   live site". The Edit button and the dialogs are in js/language.js. */
(function () {
  "use strict";
  var S = window.Scizor;
  var KEY = "xscizorr-github", API = "https://api.github.com";
  var OBJ = "application/vnd.github.object+json", RAW = "application/vnd.github.raw+json";

  function stored() { try { var g = JSON.parse(localStorage.getItem(KEY)); return g && g.token ? g : null; } catch (e) { return null; } }
  var gh = stored();

  // Which repository: data/config.js (github: { owner, repo }) if it's set there, otherwise worked out from a GitHub
  // Pages address (name.github.io/repo/...)
  function guess() {
    var c = (window.SCIZOR_CONFIG || {}).github || {};
    var m = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname), seg = location.pathname.split("/")[1] || "";
    return {
      owner: c.owner || (m ? m[1] : ""),
      repo: c.repo || (m ? (seg && !/\.html?$/i.test(seg) ? seg : m[1] + ".github.io") : ""),
      branch: c.branch || "", path: c.path || "data/cards.js"
    };
  }

  function call(token, method, url, body, accept) {
    var headers = { Authorization: "Bearer " + token, Accept: accept || "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (body) headers["Content-Type"] = "application/json";
    return fetch(API + url, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { var e = new Error(j.message || r.statusText || "GitHub said no"); e.status = r.status; throw e; });
      return accept === RAW ? r.text() : r.json();
    });
  }
  function repoURL(g) { return "/repos/" + encodeURIComponent(g.owner) + "/" + encodeURIComponent(g.repo); }
  function fileURL(g) { return repoURL(g) + "/contents/" + g.path.split("/").map(encodeURIComponent).join("/"); }
  // The file as base64 (GitHub's way of sending files), from its UTF-8 bytes
  function b64(text) {
    var bytes = new TextEncoder().encode(text), s = "";
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  // The data inside a cards.js file ("window.SCIZOR_SEED = {...};")
  function parse(text) {
    var a = text.indexOf("{", text.indexOf("SCIZOR_SEED")), b = text.lastIndexOf("}");
    if (a < 0 || b < a) throw new Error("data/cards.js on GitHub doesn't look like a card list");
    return JSON.parse(text.slice(a, b + 1));
  }

  // ------------------------------------------------------------ connecting
  // Checks the key can change the repository before keeping it
  function connect(owner, repo, token) {
    var g = guess(); g.owner = owner.trim(); g.repo = repo.trim(); g.token = token.trim();
    return call(g.token, "GET", repoURL(g)).then(function (r) {
      if (!r.permissions || !r.permissions.push) throw new Error("That key can see " + g.owner + "/" + g.repo + " but can't change it. Give it Contents: Read and write.");
      if (!g.branch) g.branch = r.default_branch || "main";
      return call(g.token, "GET", fileURL(g) + "?ref=" + encodeURIComponent(g.branch), null, OBJ).then(function () {
        localStorage.setItem(KEY, JSON.stringify(g)); gh = g;
        return g;
      }, function (e) {
        if (e.status === 404) throw new Error("There's no " + g.path + " in " + g.owner + "/" + g.repo + " (branch " + g.branch + ").");
        throw e;
      });
    }, function (e) {
      if (e.status === 401) throw new Error("GitHub didn't accept that key. Check it was copied in full and hasn't expired.");
      if (e.status === 404) throw new Error("Couldn't find " + g.owner + "/" + g.repo + ". Check the names, and that the key has access to it.");
      throw e;
    });
  }
  function disconnect() { try { localStorage.removeItem(KEY); } catch (e) {} gh = null; }

  // ------------------------------------------------------------ saving
  // A moment after your last change, the card list on GitHub (which may have changes from another computer) gets
  // this browser's edits on top and is saved back. One save at a time; changes made meanwhile go in the next one.
  var timer, busy = false, again = false, statusFns = [];
  function say(state, detail) { statusFns.forEach(function (fn) { fn(state, detail); }); }
  function schedule() { if (!gh || !S.isDirty()) return; clearTimeout(timer); say("waiting"); timer = setTimeout(push, 1500); }
  function push() {
    if (!gh || !S.isDirty()) return;
    if (busy) { again = true; return; }
    busy = true; say("saving");
    var g = gh, editsThen = S.editCount(), savedAt = Date.now(), ref = "?ref=" + encodeURIComponent(g.branch);
    Promise.all([call(g.token, "GET", fileURL(g) + ref, null, OBJ), call(g.token, "GET", fileURL(g) + ref, null, RAW)])
      .then(function (r) {
        var text = S.dataFileFor(parse(r[1]), savedAt, "Saved from the xscizorr website");
        return call(g.token, "PUT", fileURL(g), { message: "Update the card list from the website", content: b64(text), sha: r[0].sha, branch: g.branch });
      })
      .then(function () { S.markPushed(savedAt, editsThen); say("saved"); })
      .catch(function (e) {
        if (e.status === 409) { again = true; return; }   // the file changed on GitHub while saving: try again
        say("failed", e.status === 401 ? "GitHub no longer accepts your key. Connect again with ?owner." : e.message);
      })
      .then(function () { busy = false; if (again) { again = false; push(); } });
  }
  S.onChange(schedule);
  // Edits that couldn't be saved last time (offline, say) go now
  if (gh && S.isDirty()) setTimeout(push, 800);

  window.ScizorGitHub = {
    connected: function () { return !!gh; },
    repo: function () { return gh ? gh.owner + "/" + gh.repo : ""; },
    guess: guess, connect: connect, disconnect: disconnect, saveNow: push,
    onStatus: function (fn) { statusFns.push(fn); }
  };
})();
