// PerplexPin SW Cache Guard — injected into Perplexity's HTML cache
// Runs before any Perplexity scripts to enforce model preference
(function() {
  var PK = "pplx.local-user-settings.preferredSearchModels-v1";
  var SK = "__perplexpin";

  function getSaved() {
    try { return JSON.parse(localStorage.getItem(SK) || "{}"); } catch(e) { return {}; }
  }

  // 1) Apply saved model immediately
  var saved = getSaved();
  if (saved.modelId) {
    try {
      var p = JSON.parse(localStorage.getItem(PK) || "{}");
      if (p.search !== saved.modelId) {
        p.search = saved.modelId;
        Storage.prototype.setItem.call(localStorage, PK, JSON.stringify(p));
        console.log("[PerplexPin] Model enforced:", saved.modelId);
      }
    } catch(e) {}
  }

  // 2) Monkey-patch localStorage.setItem to block overwrites
  var orig = Storage.prototype.setItem.bind(localStorage);
  localStorage.setItem = function(k, v) {
    if (k === PK && !window.__perplexpin_switching) {
      try {
        var s = getSaved();
        if (s.modelId) {
          var o = JSON.parse(v);
          if (o.search !== s.modelId) {
            o.search = s.modelId;
            v = JSON.stringify(o);
            console.log("[PerplexPin] Blocked drift");
          }
        }
      } catch(e) {}
    }
    return orig(k, v);
  };
  window.__perplexpin_guarded = true;
  console.log("[PerplexPin] Guard active (SW cache)");

  // 3) Polling fallback every 3s
  setInterval(function() {
    var s = getSaved();
    if (!s.modelId) return;
    try {
      var p = JSON.parse(localStorage.getItem(PK) || "{}");
      if (p.search !== s.modelId) {
        p.search = s.modelId;
        Storage.prototype.setItem.call(localStorage, PK, JSON.stringify(p));
        console.log("[PerplexPin] Drift corrected");
      }
    } catch(e) {}
  }, 3000);

  // 4) Self-healing: re-inject into SW cache if Perplexity updates it
  function reinjectCache() {
    if (typeof caches === "undefined") return;
    caches.open("pplx-html-v2").then(function(c) {
      c.keys().then(function(ks) {
        ks.forEach(function(req) {
          c.match(req).then(function(resp) {
            if (!resp) return;
            resp.text().then(function(html) {
              if (html.indexOf("data-perplexpin") !== -1) return;
              var tag = document.querySelector("script[data-perplexpin]");
              if (!tag) return;
              var inject = '<script data-perplexpin="1">' + tag.textContent + "<\/script>";
              var nh;
              var hi = html.indexOf("<head");
              if (hi !== -1) {
                var gt = html.indexOf(">", hi);
                nh = html.substring(0, gt + 1) + inject + html.substring(gt + 1);
              } else {
                nh = inject + html;
              }
              var hd = {};
              resp.headers.forEach(function(v, k) { hd[k] = v; });
              c.put(req, new Response(nh, { status: resp.status, statusText: resp.statusText, headers: hd }));
              console.log("[PerplexPin] Re-injected cache:", req.url.substring(0, 60));
            });
          });
        });
      });
    }).catch(function() {});
  }
  setTimeout(reinjectCache, 5000);
  setInterval(reinjectCache, 30000);
})();
