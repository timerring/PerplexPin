// PerplexPin — paste ONCE in Perplexity console
// Injects a persistent guard into Perplexity's Service Worker cache
// The guard auto-runs on every page load and blocks model resets
(async function() {
  var SK = '__perplexpin';
  var PK = 'pplx.local-user-settings.preferredSearchModels-v1';
  var BADGES = ['new', 'max', 'pro', 'free', 'beta'];
  window.__perplexpin_switching = false;

  function getSaved() {
    try { return JSON.parse(localStorage.getItem(SK) || '{}'); } catch(e) { return {}; }
  }
  function getPrefs() {
    try { return JSON.parse(localStorage.getItem(PK) || '{}'); } catch(e) { return {}; }
  }

  // ── The guard script that gets injected into the SW cache ──
  // This runs at <head> before any Perplexity JS
  var GUARD_CODE = '(function(){' +
    'var PK="pplx.local-user-settings.preferredSearchModels-v1";' +
    'var SK="__perplexpin";' +
    'function gs(){try{return JSON.parse(localStorage.getItem(SK)||"{}")}catch(e){return {}}}' +
    'var sv=gs();' +
    'if(sv.modelId){try{var p=JSON.parse(localStorage.getItem(PK)||"{}");' +
    'if(p.search!==sv.modelId){p.search=sv.modelId;' +
    'Storage.prototype.setItem.call(localStorage,PK,JSON.stringify(p));' +
    'console.log("[PerplexPin] Model enforced:",sv.modelId)}}catch(e){}}' +
    'var orig=Storage.prototype.setItem.bind(localStorage);' +
    'localStorage.setItem=function(k,v){' +
    'if(k===PK&&!window.__perplexpin_switching){try{var s=gs();if(s.modelId){var o=JSON.parse(v);' +
    'if(o.search!==s.modelId){o.search=s.modelId;v=JSON.stringify(o);' +
    'console.log("[PerplexPin] Blocked drift")}}}catch(e){}}' +
    'return orig(k,v)};' +
    'window.__perplexpin_guarded=true;' +
    'console.log("[PerplexPin] Guard active");' +
    'setInterval(function(){if(window.__perplexpin_switching)return;var s=gs();if(!s.modelId)return;' +
    'try{var p=JSON.parse(localStorage.getItem(PK)||"{}");' +
    'if(p.search!==s.modelId){p.search=s.modelId;' +
    'Storage.prototype.setItem.call(localStorage,PK,JSON.stringify(p));' +
    'console.log("[PerplexPin] Drift corrected")}}catch(e){}},3000);' +
    'function ric(){if(typeof caches==="undefined")return;' +
    'caches.open("pplx-html-v2").then(function(c){c.keys().then(function(ks){' +
    'ks.forEach(function(req){c.match(req).then(function(resp){if(!resp)return;' +
    'resp.text().then(function(html){if(html.indexOf("data-perplexpin")!==-1)return;' +
    'var tg=document.querySelector("script[data-perplexpin]");if(!tg)return;' +
    'var inj="<script data-perplexpin=\\"1\\">"+tg.textContent+"<\\/script>";' +
    'var hi=html.indexOf("<head");if(hi!==-1){var gt=html.indexOf(">",hi);' +
    'html=html.substring(0,gt+1)+inj+html.substring(gt+1)}else{html=inj+html}' +
    'var hd={};resp.headers.forEach(function(v,k){hd[k]=v});' +
    'c.put(req,new Response(html,{status:resp.status,statusText:resp.statusText,headers:hd}));' +
    'console.log("[PerplexPin] Cache re-injected:",req.url.substring(0,50))})})})})}).catch(function(){})}' +
    'setTimeout(ric,3000);setInterval(ric,15000);' +
    'if(location.pathname.indexOf("/sidecar/")!==-1){' +
    'function ppSc(){var sv=gs();if(!sv.modelId)return;' +
    'var tn=sv.modelName||"";if(tn.indexOf(" Thinking")!==-1)tn=tn.replace(" Thinking","");' +
    'var btns=document.querySelectorAll("button[aria-label]");var mb=null;' +
    'for(var i=0;i<btns.length;i++){var l=btns[i].getAttribute("aria-label")||"";' +
    'if(l.length>2&&l.length<50&&l!=="Menu"&&l.indexOf("Add ")!==0&&l!=="Dictation"&&l!=="Voice mode"){mb=btns[i];break;}}' +
    'if(!mb){setTimeout(ppSc,2000);return;}' +
    'if(mb.getAttribute("aria-label")===tn){console.log("[PerplexPin] Sidecar OK");return;}' +
    'mb.click();setTimeout(function(){' +
    'var items=document.querySelectorAll("[role=menuitem]");' +
    'for(var j=0;j<items.length;j++){var t=items[j].textContent||"";' +
    'if(t.indexOf(tn)!==-1&&t.indexOf("Best")===-1){items[j].click();' +
    'console.log("[PerplexPin] Sidecar set: "+tn);return;}}' +
    'document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));' +
    '},1500);}setTimeout(ppSc,3000);setInterval(function(){ppSc()},10000);}' +
    '})()';

  var SCRIPT_TAG = '<script data-perplexpin="1">' + GUARD_CODE + '<\/script>';

  // ── Inject into SW HTML cache ──
  async function injectCache() {
    if (typeof caches === 'undefined') return 0;
    var cache = await caches.open('pplx-html-v2');
    var keys = await cache.keys();
    var count = 0;
    for (var i = 0; i < keys.length; i++) {
      var req = keys[i];
      var resp = await cache.match(req);
      if (!resp) continue;
      var html = await resp.text();
      // Remove old injection
      var clean = html;
      var si = clean.indexOf('<script data-perplexpin');
      while (si !== -1) {
        var ei = clean.indexOf('</scri' + 'pt>', si);
        if (ei !== -1) { clean = clean.substring(0, si) + clean.substring(ei + 9); }
        else break;
        si = clean.indexOf('<script data-perplexpin');
      }
      // Inject after <head...>
      var headIdx = clean.indexOf('<head');
      if (headIdx !== -1) {
        var gt = clean.indexOf('>', headIdx);
        clean = clean.substring(0, gt + 1) + SCRIPT_TAG + clean.substring(gt + 1);
      } else {
        clean = SCRIPT_TAG + clean;
      }
      var headers = {};
      resp.headers.forEach(function(v, k) { headers[k] = v; });
      await cache.put(req, new Response(clean, {
        status: resp.status, statusText: resp.statusText, headers: headers
      }));
      count++;
    }
    return count;
  }

  // ── Extract models from dropdown ──
  async function extractModels() {
    var btn = document.querySelector('[data-ask-input-container] button.px-3');
    if (!btn) return {models: [], hasThinking: false};
    btn.click();
    await new Promise(function(r) { setTimeout(r, 1500); });
    var menu = document.querySelector('[role="menu"]');
    if (!menu) {
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
      return {models: [], hasThinking: false};
    }
    var models = [];
    var hasThinking = false;
    var items = menu.querySelectorAll('[role="menuitem"]');
    for (var i = 0; i < items.length; i++) {
      var span = items[i].querySelector('.flex.items-center span');
      var name = span ? span.textContent.trim() : '';
      if (!name || BADGES.indexOf(name.toLowerCase()) !== -1) continue;
      if (name === 'Thinking') { hasThinking = true; continue; }
      models.push({name: name});
    }
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    await new Promise(function(r) { setTimeout(r, 300); });
    if (document.querySelector('[role="menu"]')) btn.click();
    return {models: models, hasThinking: hasThinking};
  }

  // ── Resolve model ID by clicking in dropdown ──
  async function resolveModelId(modelName, wantThinking) {
    // Temporarily bypass ALL monkey-patches so Perplexity can write freely
    var _patched = localStorage.setItem;
    localStorage.setItem = Storage.prototype.setItem.bind(localStorage);

    var btn = document.querySelector('[data-ask-input-container] button.px-3');
    if (!btn) { console.warn('[PerplexPin] Dropdown button not found'); localStorage.setItem = _patched; return null; }
    btn.click();
    await new Promise(function(r) { setTimeout(r, 2000); });
    var menu = document.querySelector('[role="menu"]');
    if (!menu) { console.warn('[PerplexPin] Menu did not open'); localStorage.setItem = _patched; return null; }
    var items = menu.querySelectorAll('[role="menuitem"]');
    var clicked = false;
    var foundNames = [];
    for (var i = 0; i < items.length; i++) {
      var spans = items[i].querySelectorAll('.flex.items-center span');
      var itemName = '';
      for (var si = 0; si < spans.length; si++) {
        var t = spans[si].textContent.trim();
        if (t && BADGES.indexOf(t.toLowerCase()) === -1 && t !== 'Thinking') {
          itemName = t; break;
        }
      }
      if (itemName) foundNames.push(itemName);
      if (itemName === modelName) {
        items[i].click(); clicked = true;
        await new Promise(function(r) { setTimeout(r, 800); });
        break;
      }
    }
    // Fallback: partial match
    if (!clicked) {
      for (var i = 0; i < items.length; i++) {
        var text = items[i].textContent || '';
        if (text.indexOf(modelName) !== -1) {
          items[i].click(); clicked = true;
          await new Promise(function(r) { setTimeout(r, 800); });
          break;
        }
      }
    }
    if (!clicked) {
      console.warn('[PerplexPin] Could not find "' + modelName + '" in dropdown. Found:', foundNames);
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
      localStorage.setItem = _patched;
      return null;
    }
    // Handle thinking toggle
    if (wantThinking) {
      btn.click();
      await new Promise(function(r) { setTimeout(r, 2000); });
      var sw = document.querySelector('[role="switch"]');
      if (sw && sw.getAttribute('aria-checked') !== 'true') {
        sw.click();
        await new Promise(function(r) { setTimeout(r, 800); });
      }
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
      await new Promise(function(r) { setTimeout(r, 300); });
    }
    // Restore monkey-patch
    localStorage.setItem = _patched;
    return getPrefs().search || null;
  }

  // ── Picker UI ──
  function showUI(result) {
    var models = result;
    var old = document.getElementById('__perplexpin_ui');
    if (old) old.remove();
    var saved = getSaved();
    var overlay = document.createElement('div');
    overlay.id = '__perplexpin_ui';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-family:system-ui;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var panel = document.createElement('div');
    panel.style.cssText = 'background:#1a1a2e;border-radius:16px;padding:20px;min-width:320px;max-width:400px;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);border:1px solid rgba(139,139,255,0.2);';

    var thinkingOn = saved.thinking || false;

    panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
      '<span style="font-size:16px;font-weight:700;color:#e0e0e0;">\uD83D\uDCCC PerplexPin Setup</span></div>' +
      '<div style="color:#888;font-size:11px;margin-bottom:10px;">Select a model to pin. Guard will be injected into SW cache.</div>';

    // Thinking toggle (if available)
    if (models.hasThinking) {
      var thinkRow = document.createElement('div');
      thinkRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;margin-bottom:8px;background:rgba(139,139,255,0.08);border-radius:8px;border:1px solid rgba(139,139,255,0.15);';
      var thinkLabel = document.createElement('span');
      thinkLabel.style.cssText = 'font-size:13px;color:#ccc;';
      thinkLabel.textContent = '\uD83E\uDDE0 Thinking Mode';
      thinkRow.appendChild(thinkLabel);
      var thinkToggle = document.createElement('button');
      thinkToggle.style.cssText = 'width:40px;height:22px;border-radius:11px;border:none;cursor:pointer;transition:background 0.2s;position:relative;background:' + (thinkingOn ? '#4a4aff' : '#444') + ';';
      thinkToggle.innerHTML = '<span style="display:block;width:16px;height:16px;border-radius:50%;background:#fff;position:absolute;top:3px;transition:left 0.2s;left:' + (thinkingOn ? '21px' : '3px') + ';"></span>';
      thinkToggle.onclick = function() {
        thinkingOn = !thinkingOn;
        thinkToggle.style.background = thinkingOn ? '#4a4aff' : '#444';
        thinkToggle.querySelector('span').style.left = thinkingOn ? '21px' : '3px';
      };
      thinkRow.appendChild(thinkToggle);
      panel.appendChild(thinkRow);
    }

    // Unpin button
    if (saved.modelId) {
      var upb = document.createElement('button');
      upb.textContent = '\uD83D\uDD13 Unpin (' + (saved.modelName || saved.modelId) + ')';
      upb.style.cssText = 'width:100%;padding:8px;margin-bottom:8px;background:#3a2020;color:#ff8888;border:1px solid rgba(255,100,100,0.2);border-radius:8px;cursor:pointer;font-size:12px;';
      upb.onclick = function() {
        localStorage.removeItem(SK);
        overlay.remove();
        var b = document.getElementById('__perplexpin_badge');
        if (b) b.remove();
        console.log('[PerplexPin] Unpinned');
      };
      panel.appendChild(upb);
    }

    var list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

    var modelList = models.models || models;
    for (var i = 0; i < modelList.length; i++) {
      (function(m) {
        var sel = saved.modelName === m.name || saved.modelName === m.name + ' Thinking';
        var btn = document.createElement('button');
        btn.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;padding:10px;border:none;border-radius:8px;cursor:pointer;font-size:13px;text-align:left;transition:background 0.15s;background:' +
          (sel ? '#2d2d5e' : 'transparent') + ';color:' + (sel ? '#8b8bff' : '#e0e0e0') + ';';
        btn.onmouseenter = function() { if (!sel) btn.style.background = '#252540'; };
        btn.onmouseleave = function() { if (!sel) btn.style.background = 'transparent'; };

        var icon = document.createElement('span');
        icon.style.cssText = 'width:28px;height:28px;border-radius:7px;background:#333;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;';
        icon.textContent = m.name.charAt(0).toUpperCase();
        btn.appendChild(icon);

        var label = document.createElement('span');
        label.style.cssText = 'flex:1;';
        label.textContent = m.name;
        btn.appendChild(label);

        if (sel) {
          var ck = document.createElement('span');
          ck.textContent = '\u2713';
          ck.style.color = '#8b8bff';
          btn.appendChild(ck);
        }

        btn.onclick = async function() {
          var selectedName = m.name;
          var selectedThinking = thinkingOn;

          // 1) Close picker overlay first so it doesn't block the dropdown
          overlay.remove();
          await new Promise(function(r) { setTimeout(r, 500); });

          // 2) Temporarily remove saved pin so old drift timers don't interfere
          var _savedPin = localStorage.getItem(SK);
          Storage.prototype.removeItem.call(localStorage, SK);
          window.__perplexpin_switching = true;

          var id = await resolveModelId(selectedName, selectedThinking);

          window.__perplexpin_switching = false;
          if (!id) {
            // Restore old pin on failure
            if (_savedPin) Storage.prototype.setItem.call(localStorage, SK, _savedPin);
            console.error('[PerplexPin] Could not resolve model ID for ' + selectedName);
            var retry = await extractModels();
            if (retry.models.length > 0) showUI(retry);
            return;
          }

          // 3) Save preference
          var displayName = selectedName + (selectedThinking ? ' Thinking' : '');
          localStorage.setItem(SK, JSON.stringify({modelId: id, modelName: displayName, thinking: selectedThinking}));

          // 3) Inject guard into SW cache
          var count = await injectCache();

          // 4) Start guard for current session (always replace to override old patches)
          var origSI2 = Storage.prototype.setItem.bind(localStorage);
          localStorage.setItem = function(k, v) {
            if (k === PK && !window.__perplexpin_switching) {
              try {
                var s = getSaved();
                if (s.modelId) {
                  var o = JSON.parse(v);
                  if (o.search !== s.modelId) {
                    o.search = s.modelId;
                    v = JSON.stringify(o);
                    console.log('[PerplexPin] Blocked drift');
                  }
                }
              } catch(e) {}
            }
            return origSI2(k, v);
          };
          window.__perplexpin_guarded = true;
          setInterval(function() {
            if (window.__perplexpin_switching) return;
            var s = getSaved();
            if (!s.modelId) return;
            var p = getPrefs();
            if (p.search !== s.modelId) {
              p.search = s.modelId;
              Storage.prototype.setItem.call(localStorage, PK, JSON.stringify(p));
              console.log('[PerplexPin] Drift corrected');
            }
          }, 3000);

          overlay.remove();
          showBadge(displayName);
          console.log('[PerplexPin] Pinned ' + displayName + ' (' + id + '), guard injected into ' + count + ' cached pages');
        };
        list.appendChild(btn);
      })(modelList[i]);
    }
    panel.appendChild(list);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  // ── Badge ──
  function showBadge(name) {
    var old = document.getElementById('__perplexpin_badge');
    if (old) old.remove();
    var badge = document.createElement('div');
    badge.id = '__perplexpin_badge';
    badge.style.cssText = 'position:fixed;top:12px;right:20px;z-index:999998;background:#1a1a2e;color:#8b8bff;border-radius:20px;padding:6px 12px;font-family:system-ui;font-size:12px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3);border:1px solid rgba(139,139,255,0.3);display:flex;align-items:center;gap:6px;';
    badge.innerHTML = '<span>\uD83D\uDCCC</span><span>' + name + '</span>';
    badge.title = 'Click to change pinned model';
    badge.onclick = async function() {
      var result = await extractModels();
      if (result.models.length > 0) showUI(result);
    };
    document.body.appendChild(badge);
  }

  // ── Main ──
  var saved = getSaved();
  if (saved.modelId) {
    // Already pinned — re-apply guard
    var prefs = getPrefs();
    if (prefs.search !== saved.modelId) {
      prefs.search = saved.modelId;
      Storage.prototype.setItem.call(localStorage, PK, JSON.stringify(prefs));
    }
    await injectCache();
    // Start session guard (always replace to override old SW cache patches)
    var origSI = Storage.prototype.setItem.bind(localStorage);
    localStorage.setItem = function(k, v) {
      if (k === PK && !window.__perplexpin_switching) {
        try {
          var s = getSaved();
          if (s.modelId) {
            var o = JSON.parse(v);
            if (o.search !== s.modelId) {
              o.search = s.modelId;
              v = JSON.stringify(o);
              console.log('[PerplexPin] Blocked drift');
            }
          }
        } catch(e) {}
      }
      return origSI(k, v);
    };
    window.__perplexpin_guarded = true;
    console.log('[PerplexPin] Guard active, pinned: ' + saved.modelName);
  }
  // Always show picker (first time or switch model)
  var result = await extractModels();
  if (result.models.length > 0) {
    showUI(result);
  } else if (!saved.modelId) {
    console.log('[PerplexPin] No models found. Make sure you are on the Perplexity homepage with the model selector visible.');
  }
})();
