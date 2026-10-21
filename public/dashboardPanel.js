// SFMC Toolkit card on SFMC's Marketing Cloud Dashboard page (feedback #65, a trial):
// automations and journeys of the business unit (counts by status, what needs a
// look, watched items) with links into SFMC Toolkit. The service worker reads SFMC
// (DASHBOARD_SUMMARY, src/background/dashboard.js); this script only shows it.
// Runs in a shadow root. Close hides it until the page is opened again; "Turn off"
// sets _dashboardPanel to false (Settings > Connection turns it back on).
(function () {
  'use strict';
  if (window.top !== window) return;

  var SETTING = '_dashboardPanel';
  var COLLAPSED = '_dashboardPanelCollapsed';
  var HOST_ID = 'sfmc-toolkit-dashboard-card';

  var host = null;
  var root = null;
  var enabled = true;
  var collapsed = false;
  var closedFor = '';
  var lastHref = '';
  var token = 0;

  function parse(href) {
    try {
      var url = new URL(href);
      var parts = url.hostname.split('.');
      if (parts[0] !== 'mc' || !/^s\d+$/i.test(parts[1] || '') || parts.slice(2).join('.') !== 'exacttarget.com') return null;
      var hash = decodeURIComponent(url.hash || '');
      return /^#app\/Marketing Cloud Dashboard(\/|$)/i.test(hash) ? { stack: parts[1].toLowerCase() } : null;
    } catch (e) {
      return null;
    }
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function send(message) {
    return new Promise(function (resolve, reject) {
      try {
        chrome.runtime.sendMessage(message, function (res) {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (!res) return reject(new Error('No reply from SFMC Toolkit.'));
          if (res.error) return reject(new Error(res.error));
          resolve(res);
        });
      } catch (e) {
        reject(new Error('SFMC Toolkit was updated. Reload this page to see the card.'));
      }
    });
  }

  function openApp(path) {
    send({ type: 'OPEN_APP', path: path }).catch(function (e) { showError(e.message); });
  }

  var CSS = [
    ':host{all:initial}',
    '.card{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:340px;max-height:70vh;display:flex;flex-direction:column;background:#fff;color:#1e293b;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
    '.head{display:flex;align-items:center;gap:6px;padding:8px 10px 8px 12px;border-bottom:1px solid #e2e8f0}',
    '.title{font-weight:700;font-size:13px;flex:1;margin:0}.trial{font:600 10px/1 inherit;color:#4f46e5;border:1px solid #c7d2fe;background:#eef2ff;border-radius:999px;padding:3px 6px}',
    '.ib{border:0;background:none;cursor:pointer;color:#64748b;font-size:16px;line-height:1;padding:2px 4px;border-radius:4px}.ib:hover{background:#f1f5f9}',
    '.collapsed .body,.collapsed .foot{display:none}.collapsed .head{border-bottom:0}',
    '.body{overflow:auto;padding:8px 12px}',
    '.h{display:flex;align-items:baseline;gap:6px;font-weight:600;font-size:12px;margin:8px 0 4px}.h:first-child{margin-top:2px}.h .n{font-weight:400;color:#64748b}',
    '.stats{display:flex;gap:8px;margin:2px 0 4px}.stat{flex:1;border:1px solid #e2e8f0;border-radius:6px;padding:5px 7px}.stat b{display:block;font-size:17px}.stat span{font-size:11px;color:#64748b}.bad b{color:#b91c1c}',
    '.chips{display:flex;flex-wrap:wrap;gap:4px;margin:2px 0 4px}.chip{font-size:11px;background:#f1f5f9;border-radius:999px;padding:1px 7px}',
    '.item{display:block;width:100%;text-align:left;border:0;background:none;cursor:pointer;padding:3px 0;font:12px/1.35 inherit;color:inherit;border-bottom:1px solid #f1f5f9}.item:hover .nm{text-decoration:underline}',
    '.nm{font-weight:600;color:#4338ca}.why{display:block;color:#64748b;font-size:11px}',
    '.more{border:0;background:none;color:#4f46e5;cursor:pointer;font:600 12px/1 inherit;padding:4px 0}',
    '.msg{color:#64748b;font-size:12px;padding:6px 0}.err{color:#b91c1c;font-size:12px;padding:4px 0}',
    '.foot{display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b}',
    '.foot .sp{flex:1}.lk{border:0;background:none;color:#4f46e5;cursor:pointer;font:600 11px/1 inherit;padding:0}',
    '@media (prefers-color-scheme: dark){.card{background:#0f172a;color:#e2e8f0;border-color:#1e293b}.head,.foot{border-color:#1e293b}.stat{border-color:#1e293b}.chip{background:#1e293b}.item{border-color:#1e293b}.ib:hover{background:#1e293b}.nm{color:#a5b4fc}}',
  ].join('');

  function mount() {
    if (host && document.contains(host)) return;
    host = document.createElement('div');
    host.id = HOST_ID;
    root = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = CSS;
    var card = el('section', 'card' + (collapsed ? ' collapsed' : ''));
    card.setAttribute('aria-label', 'SFMC Toolkit summary');
    var head = el('div', 'head');
    head.appendChild(el('p', 'title', 'SFMC Toolkit'));
    var trial = el('span', 'trial', 'Trial');
    trial.title = 'A trial: tell us what you think with Feedback in SFMC Toolkit';
    head.appendChild(trial);
    var fold = el('button', 'ib fold', collapsed ? '+' : '−');
    fold.type = 'button';
    fold.setAttribute('aria-label', collapsed ? 'Expand' : 'Collapse');
    fold.addEventListener('click', function () { setCollapsed(!collapsed); });
    var x = el('button', 'ib', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    x.title = 'Close until this page is opened again';
    x.addEventListener('click', function () { closedFor = location.href; unmount(); });
    head.appendChild(fold);
    head.appendChild(x);
    var body = el('div', 'body');
    var foot = el('div', 'foot');
    var when = el('span', 'when', '');
    var sp = el('span', 'sp');
    var refresh = el('button', 'lk', 'Refresh');
    refresh.type = 'button';
    refresh.addEventListener('click', function () { load(true); });
    var off = el('button', 'lk', 'Turn off');
    off.type = 'button';
    off.title = 'Stop showing this card. Turn it back on in SFMC Toolkit: Settings > Connection.';
    off.addEventListener('click', function () { try { chrome.storage.local.set({ _dashboardPanel: false }); } catch (e) { /* gone */ } unmount(); });
    foot.appendChild(when);
    foot.appendChild(sp);
    foot.appendChild(refresh);
    foot.appendChild(off);
    card.appendChild(head);
    card.appendChild(body);
    card.appendChild(foot);
    root.appendChild(style);
    root.appendChild(card);
    (document.body || document.documentElement).appendChild(host);
    if (!collapsed) load(false);
  }

  function unmount() {
    token++;
    if (host) host.remove();
    host = null;
    root = null;
  }

  function setCollapsed(v) {
    collapsed = v;
    try { var o = {}; o[COLLAPSED] = v; chrome.storage.local.set(o); } catch (e) { /* gone */ }
    if (!root) return;
    root.querySelector('.card').classList.toggle('collapsed', v);
    var f = root.querySelector('.fold');
    f.textContent = v ? '+' : '−';
    f.setAttribute('aria-label', v ? 'Expand' : 'Collapse');
    if (!v && !root.querySelector('.body').childNodes.length) load(false);
  }

  function body() { return root && root.querySelector('.body'); }
  function showError(text) {
    var b = body();
    if (b) b.appendChild(el('div', 'err', text));
  }

  function stat(parent, n, label, bad) {
    var s = el('div', 'stat' + (bad ? ' bad' : ''));
    s.appendChild(el('b', '', Number(n || 0).toLocaleString()));
    s.appendChild(el('span', '', label));
    parent.appendChild(s);
  }

  function heading(b, text, count) {
    var h = el('div', 'h', text);
    if (count !== undefined) h.appendChild(el('span', 'n', '(' + count + ')'));
    b.appendChild(h);
  }

  function chips(b, list) {
    var c = el('div', 'chips');
    (list || []).forEach(function (s) { c.appendChild(el('span', 'chip', s.label + ' ' + s.count)); });
    b.appendChild(c);
  }

  function item(b, name, why, path) {
    var i = el('button', 'item');
    i.type = 'button';
    i.appendChild(el('span', 'nm', name));
    if (why) i.appendChild(el('span', 'why', why));
    i.addEventListener('click', function () { openApp(path); });
    b.appendChild(i);
  }

  function more(b, text, path) {
    var m = el('button', 'more', text);
    m.type = 'button';
    m.addEventListener('click', function () { openApp(path); });
    b.appendChild(m);
  }

  function render(s) {
    var b = body();
    if (!b) return;
    b.textContent = '';
    var a = s.automations;
    heading(b, 'Automations');
    if (a) {
      var st = el('div', 'stats');
      stat(st, a.total, 'automations');
      stat(st, a.failedLastRun, 'last run failed', a.failedLastRun > 0);
      stat(st, a.attentionCount, 'need a look', a.attentionCount > 0);
      b.appendChild(st);
      chips(b, a.byStatus);
      (a.attention || []).forEach(function (x) { item(b, x.name, x.reason, '/automations/' + encodeURIComponent(x.id)); });
      more(b, a.attentionCount > (a.attention || []).length ? 'All ' + a.attentionCount + ' in Automation overview' : 'Automation overview', '/automation-overview');
    } else {
      b.appendChild(el('div', 'err', 'Could not read the automations: ' + ((s.errors && s.errors.automations) || 'unknown error')));
    }
    var j = s.journeys;
    heading(b, 'Journeys');
    if (j) {
      var sj = el('div', 'stats');
      stat(sj, j.total, 'journeys');
      stat(sj, j.live, 'live');
      b.appendChild(sj);
      chips(b, j.byStatus);
      more(b, 'Journey overview', '/journey-overview');
    } else {
      b.appendChild(el('div', 'err', 'Could not read the journeys: ' + ((s.errors && s.errors.journeys) || 'unknown error')));
    }
    var w = s.watched || [];
    heading(b, 'Watched', w.length);
    if (!w.length) b.appendChild(el('div', 'msg', 'Nothing watched on this stack. Click Watch on an automation or journey in SFMC Toolkit.'));
    w.forEach(function (x) {
      var why = [x.status, x.lastRunStatus ? 'last run ' + x.lastRunStatus : ''].filter(Boolean).join(', ');
      item(b, x.name, (x.type === 'journey' ? 'Journey' : 'Automation') + (why ? ': ' + why : ''), (x.type === 'journey' ? '/journeys/' : '/automations/') + encodeURIComponent(x.id));
    });
    var when = root.querySelector('.when');
    if (when) when.textContent = (s.businessUnit ? s.businessUnit + ', ' : '') + 'read ' + new Date(s.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function load(force) {
    var ctx = parse(location.href);
    var b = body();
    if (!ctx || !b) return;
    var mine = ++token;
    b.textContent = '';
    b.appendChild(el('div', 'msg', 'Reading automations and journeys...'));
    send({ type: 'DASHBOARD_SUMMARY', stack: ctx.stack, force: !!force }).then(function (res) {
      if (mine !== token) return;
      render(res.summary || {});
    }).catch(function (e) {
      if (mine !== token) return;
      b.textContent = '';
      showError('Could not read SFMC: ' + e.message);
    });
  }

  function check() {
    var want = enabled && parse(location.href) && closedFor !== location.href;
    if (location.href === lastHref && !!host === !!want) return;
    if (location.href !== lastHref && closedFor && closedFor !== location.href) closedFor = '';
    lastHref = location.href;
    if (enabled && parse(location.href) && closedFor !== location.href) mount();
    else unmount();
  }

  try {
    chrome.storage.local.get([SETTING, COLLAPSED], function (r) {
      enabled = !r || r[SETTING] !== false;
      collapsed = !!(r && r[COLLAPSED]);
      check();
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'local' && SETTING in changes) { enabled = changes[SETTING].newValue !== false; check(); }
    });
  } catch (e) { /* extension context gone */ }
  window.addEventListener('hashchange', check);
  window.addEventListener('popstate', check);
  setInterval(check, 1000);
})();
