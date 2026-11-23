(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const STOPWORDS = new Set(('a an the and or but so to of in on at for with is are was were be been am i im i\'m you your you\'re ' +
    'me my we it its it\'s this that what how do does did have has had not no yes just like can could would will ' +
    'u ur r there here they them he she his her if as by from up out about any some too very really').split(' '));

  // Every chart on the dashboard; the export dialog uses the same list.
  // Labels on every bar/point show a percentage: the rate itself, or that point's share of the total.
  const BASE_CHARTS = [
    { key: 'swipes', id: 'chSwipes', group: 'Swiping', title: 'Likes and passes per month', sub: 'Labels show the share of each month\'s swipes that were likes', wide: true },
    { key: 'likeRate', id: 'chLikeRate', group: 'Swiping', title: 'Like rate per month', sub: 'Share of swipes that were right swipes' },
    { key: 'weekday', id: 'chWeekday', group: 'Swiping', title: 'Average swipes by weekday', sub: 'On days you swiped · labels show share of the week' },
    { key: 'super', id: 'chSuper', group: 'Swiping', title: 'Super Likes per month', sub: 'Labels show each month\'s share of your Super Likes', wide: true },
    { key: 'matches', id: 'chMatches', group: 'Matching', title: 'Matches per month', sub: 'Labels show each month\'s share of your matches' },
    { key: 'matchRate', id: 'chMatchRate', group: 'Matching', title: 'Match rate per month', sub: 'Matches divided by likes sent' },
    { key: 'messages', id: 'chMessages', group: 'Messaging', title: 'Messages sent and received per month', sub: 'Labels show each month\'s share of messages sent or received', wide: true },
    { key: 'hour', id: 'chHour', group: 'Messaging', title: 'When you send messages', sub: 'By hour, your local time · share of messages' },
    { key: 'convo', id: 'chConvo', group: 'Messaging', title: 'Conversation length', sub: 'Messages you sent per match · share of matches' },
    { key: 'opens', id: 'chOpens', group: 'App usage', title: 'App opens per month', sub: 'Labels show each month\'s share of app opens', wide: true },
  ];
  let CHARTS = BASE_CHARTS.slice();
  const CONVO_PAGE = 50;

  const ICONS = {
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
    swipe: '<path d="M4 12h16M14 6l6 6-6 6"/>',
    percent: '<path d="M19 5L5 19M7 9a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z"/>',
    target: '<path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8z"/>',
    phone: '<path d="M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zM11 18h2"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  };

  let data = null;
  let range = 'all';
  let view = null;

  // ---------- Upload ----------
  const dropZone = $('dropZone');
  const fileInput = $('fileInput');

  fileInput.addEventListener('change', () => { if (fileInput.files[0]) load(fileInput.files[0]); });
  ['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.remove('dragging'); }));
  dropZone.addEventListener('drop', ev => { const f = ev.dataTransfer.files[0]; if (f) load(f); });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => e.preventDefault());

  $('demoBtn').addEventListener('click', () => show(TinderParse.normalize(TinderDemo.makeDemo()), true));
  $('resetBtn').addEventListener('click', () => {
    data = null; view = null;
    Charts.destroyAll();
    fileInput.value = '';
    $('dashView').hidden = true;
    $('uploadView').hidden = false;
    $('resetBtn').hidden = true;
    $('exportBtnTop').hidden = true;
    window.scrollTo(0, 0);
  });
  $('rangeSelect').addEventListener('change', e => { range = e.target.value; render(); });
  $('exportBtn').addEventListener('click', () => ExportReport.open());
  $('exportBtnTop').addEventListener('click', () => ExportReport.open());

  async function load(file) {
    const err = $('uploadError');
    err.hidden = true;
    dropZone.classList.add('loading');
    try {
      show(await TinderParse.readFile(file), false);
    } catch (e) {
      console.error(e);
      err.textContent = e.message || 'Something went wrong reading that file.';
      err.hidden = false;
    } finally {
      dropZone.classList.remove('loading');
    }
  }

  function show(parsed, isDemo) {
    const dates = Object.keys(parsed.days).sort();
    if (!dates.length) {
      $('uploadError').textContent = 'No activity was found in this file.';
      $('uploadError').hidden = false;
      return;
    }
    data = parsed;
    data.isDemo = isDemo;
    const years = [...new Set(dates.map(d => d.slice(0, 4)))];
    const sel = $('rangeSelect');
    sel.innerHTML = '<option value="all">All time</option><option value="12m">Last 12 months</option>' +
      years.reverse().map(y => `<option value="${y}">${y}</option>`).join('');
    range = 'all';
    sel.value = 'all';

    $('uploadView').hidden = true;
    $('dashView').hidden = false;
    $('resetBtn').hidden = false;
    $('exportBtnTop').hidden = false;
    $('dashEyebrow').textContent = isDemo ? 'Sample data' : 'Your Tinder, in numbers';
    buildExtraCharts();
    renderConversations();
    renderAllSections();
    render();
    window.scrollTo(0, 0);
  }

  // ---------- Filtering ----------
  function inRange(dateStr) {
    if (range === 'all') return true;
    if (range === '12m') {
      const last = Object.keys(data.days).sort().pop();
      const cut = new Date(last + 'T00:00:00');
      cut.setFullYear(cut.getFullYear() - 1);
      return dateStr > localDateKey(cut);
    }
    return dateStr.startsWith(range);
  }

  function localDateKey(dt) {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  // ---------- Compute everything for the current period ----------
  function compute() {
    const days = Object.entries(data.days).filter(([d]) => inRange(d)).sort((a, b) => a[0] < b[0] ? -1 : 1);
    const totals = TinderParse.blankDay();
    for (const [, v] of days) for (const k in totals) totals[k] += v[k];

    const monthly = new Map();
    if (days.length) {
      const first = days[0][0].slice(0, 7), last = days[days.length - 1][0].slice(0, 7);
      let [y, m] = first.split('-').map(Number);
      while (`${y}-${String(m).padStart(2, '0')}` <= last) {
        monthly.set(`${y}-${String(m).padStart(2, '0')}`, TinderParse.blankDay());
        if (++m > 12) { m = 1; y++; }
      }
    }
    for (const [d, v] of days) { const b = monthly.get(d.slice(0, 7)); for (const k in b) b[k] += v[k]; }
    // Extra usage series, bucketed onto the same months
    const extraMonthly = {};
    for (const [k, series] of Object.entries(data.extras || {})) {
      const arr = new Map([...monthly.keys()].map(m => [m, 0]));
      for (const [d, val] of Object.entries(series)) if (inRange(d) && arr.has(d.slice(0, 7))) arr.set(d.slice(0, 7), arr.get(d.slice(0, 7)) + val);
      extraMonthly[k] = [...arr.values()];
    }
    const mKeys = [...monthly.keys()];
    const mLabels = mKeys.map(k => MONTHS[+k.slice(5) - 1] + ' ' + k.slice(2, 4));
    const mVals = [...monthly.values()];

    const convos = data.conversations.map(c => ({ ...c, messages: c.messages.filter(m => inRange(localDateKey(m.date))) }));
    const withMsgs = convos.filter(c => c.messages.length);
    const sentMsgs = withMsgs.flatMap(c => c.messages);

    const activeDays = days.filter(([, v]) => v.opens || v.likes || v.passes).length;
    const swipes = totals.likes + totals.passes;
    const firstDay = days[0]?.[0], lastDay = days[days.length - 1]?.[0];
    const periodLabel = $('rangeSelect').selectedOptions[0]?.textContent || 'All time';

    const kpis = [
      { label: 'Matches', value: n(totals.matches), note: `${pct(totals.matches, totals.likes)} of your likes`, icon: 'heart', c: 'c2' },
      { label: 'Swipes', value: n(swipes), note: `${n(Math.round(swipes / Math.max(activeDays, 1)))} per active day`, icon: 'swipe', c: 'c1' },
      { label: 'Like rate', value: pct(totals.likes, swipes), note: `${n(totals.likes)} likes, ${n(totals.passes)} passes`, icon: 'percent', c: 'c3' },
      { label: 'Swipes per match', value: totals.matches ? n(Math.round(swipes / totals.matches)) : '–', note: 'right and left swipes combined', icon: 'target', c: 'c1' },
      { label: 'App opens', value: n(totals.opens), note: `${n(Math.round(totals.opens / Math.max(activeDays, 1)))} per active day`, icon: 'phone', c: 'c3' },
      { label: 'Messages sent', value: n(totals.sent), note: `${n(totals.received)} received`, icon: 'chat', c: 'c2' },
      { label: 'Conversations started', value: n(withMsgs.length), note: `${pct(withMsgs.length, convos.length)} of matches you messaged`, icon: 'spark', c: 'c1' },
      { label: 'Super Likes', value: n(totals.superlikes), note: totals.superlikes ? `${n(Math.round(totals.likes / totals.superlikes))} likes per Super Like` : 'none used', icon: 'star', c: 'c3' },
    ];

    // Weekday averages over days with swipes
    const wd = WEEKDAYS.map(() => ({ s: 0, c: 0 }));
    for (const [d, v] of days) {
      if (!(v.likes + v.passes)) continue;
      const i = (new Date(d + 'T12:00:00').getDay() + 6) % 7;
      wd[i].s += v.likes + v.passes; wd[i].c++;
    }
    const hours = new Array(24).fill(0);
    for (const m of sentMsgs) hours[m.date.getHours()]++;
    const buckets = [['0', 0, 0], ['1', 1, 1], ['2–5', 2, 5], ['6–10', 6, 10], ['11–25', 11, 25], ['26–50', 26, 50], ['51+', 51, Infinity]];

    const share = arr => { const t = arr.reduce((a, b) => a + (b || 0), 0); return arr.map(v => t ? (v || 0) / t : null); };
    const of = (a, b) => b ? a / b : null;
    const likeRate = mVals.map(v => of(v.likes, v.likes + v.passes));
    const matchRate = mVals.map(v => of(v.matches, v.likes));
    const wdAvg = wd.map(x => x.c ? Math.round(x.s / x.c) : 0);
    const convoCounts = buckets.map(([, lo, hi]) => convos.filter(c => c.messages.length >= lo && c.messages.length <= hi).length);

    const charts = {
      swipes: { type: 'bar', labels: mLabels, opts: { stacked: true }, pctNote: 'of month',
        datasets: [{ label: 'Likes', data: mVals.map(v => v.likes) }, { label: 'Passes', data: mVals.map(v => v.passes) }],
        pct: [likeRate, mVals.map(v => of(v.passes, v.likes + v.passes))] },
      likeRate: { type: 'line', labels: mLabels, opts: { percent: true }, datasets: [{ label: 'Like rate', data: likeRate }], pct: [likeRate] },
      weekday: { type: 'bar', labels: WEEKDAYS, pctNote: 'of week', datasets: [{ label: 'Avg swipes', data: wdAvg }], pct: [share(wdAvg)] },
      super: { type: 'bar', labels: mLabels, pctNote: 'of total', datasets: [{ label: 'Super Likes', data: mVals.map(v => v.superlikes) }], pct: [share(mVals.map(v => v.superlikes))] },
      matches: { type: 'bar', labels: mLabels, pctNote: 'of total', datasets: [{ label: 'Matches', data: mVals.map(v => v.matches) }], pct: [share(mVals.map(v => v.matches))] },
      matchRate: { type: 'line', labels: mLabels, opts: { percent: true }, datasets: [{ label: 'Match rate', data: matchRate }], pct: [matchRate] },
      messages: { type: 'line', labels: mLabels, pctNote: 'of total',
        datasets: [{ label: 'Sent', data: mVals.map(v => v.sent) }, { label: 'Received', data: mVals.map(v => v.received) }],
        pct: [share(mVals.map(v => v.sent)), share(mVals.map(v => v.received))] },
      hour: { type: 'bar', labels: hours.map((_, h) => h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : (h - 12) + 'p'), pctNote: 'of messages',
        datasets: [{ label: 'Messages', data: hours }], pct: [share(hours)] },
      convo: { type: 'bar', labels: buckets.map(b => b[0]), opts: { xTitle: 'messages sent' }, pctNote: 'of matches',
        datasets: [{ label: 'Matches', data: convoCounts }], pct: [share(convoCounts)] },
      opens: { type: 'bar', labels: mLabels, pctNote: 'of total', datasets: [{ label: 'App opens', data: mVals.map(v => v.opens) }], pct: [share(mVals.map(v => v.opens))] },
    };
    for (const [k, arr] of Object.entries(extraMonthly)) {
      charts['x:' + k] = { type: 'bar', labels: mLabels, pctNote: 'of total', datasets: [{ label: pretty(k), data: arr }], pct: [share(arr)] };
    }

    // Opening words
    const counts = new Map();
    let questions = 0;
    for (const c of withMsgs) {
      const t = c.messages[0].text;
      if (t.includes('?')) questions++;
      const words = new Set(t.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, ' ').split(/\s+/).filter(w => w.length > 1 && !STOPWORDS.has(w)));
      for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
    }
    const topWords = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24)
      .map(([w, c]) => [w, c, Charts.fmtPct(c / withMsgs.length)]);
    const avgLen = withMsgs.length ? Math.round(withMsgs.reduce((s, c) => s + c.messages[0].text.length, 0) / withMsgs.length) : 0;
    const openersNote = withMsgs.length ? `${pct(questions, withMsgs.length)} of your openers asked a question · average opener is ${avgLen} characters` : '';

    const topDays = days.map(([d, v]) => [d, v.likes + v.passes, v.matches]).filter(x => x[1])
      .sort((a, b) => b[1] - a[1]).slice(0, 6).map(([d, s, m]) => [fmtDate(d, true), n(s), n(m), pct(s, swipes)]);

    return {
      isDemo: data.isDemo,
      periodLabel,
      sub: firstDay ? `${fmtDate(firstDay)} – ${fmtDate(lastDay)} · ${activeDays.toLocaleString()} active days` : 'No activity in this period',
      title: data.isDemo ? 'Sample dashboard' : (range === 'all' ? 'All of your swiping' : periodLabel),
      hero: { value: n(totals.matches), label: totals.matches === 1 ? 'match' : 'matches' },
      profile: profileChips(),
      kpis, charts,
      openers: { words: topWords, note: openersNote },
      topDays,
      table: { labels: mLabels, vals: mVals, extras: extraMonthly },
    };
  }

  // ---------- Paint the dashboard ----------
  function render() {
    view = compute();
    $('dashTitle').textContent = view.title;
    $('dashSub').textContent = view.sub;

    const big = $('heroBig');
    big.replaceChildren();
    const bn = document.createElement('div'); bn.className = 'big-num'; bn.textContent = view.hero.value;
    const bl = document.createElement('div'); bl.className = 'big-label'; bl.textContent = view.hero.label + ' · ' + view.periodLabel.toLowerCase();
    big.append(bn, bl);

    $('profile').replaceChildren(...view.profile.map(([k, v]) => {
      const s = document.createElement('span'); s.className = 'chip';
      const b = document.createElement('b'); b.textContent = v;
      s.append(k + ': ', b);
      return s;
    }));

    $('kpis').innerHTML = view.kpis.map(k =>
      `<div class="card kpi"><div class="kpi-top"><span class="kpi-icon ${k.c}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k.icon]}</svg></span>` +
      `<span class="kpi-label">${esc(k.label)}</span></div><div class="kpi-value">${esc(k.value)}</div><div class="kpi-note">${esc(k.note)}</div></div>`).join('');

    for (const c of CHARTS) {
      const cap = $(c.id)?.closest('figure')?.querySelector('figcaption .muted');
      if (cap) cap.textContent = c.sub;
      Charts.show(c.id, view.charts[c.key]);
    }

    // Opening words (DOM APIs, no inline style attributes, so the CSP can stay strict)
    const el = $('openerWords');
    el.replaceChildren();
    const words = view.openers.words;
    if (!words.length) {
      const p = document.createElement('p'); p.className = 'empty-note'; p.textContent = 'No messages in this period.'; el.append(p);
    } else {
      const max = words[0][1];
      for (const [w, c, p] of words) {
        const span = document.createElement('span');
        span.className = 'word';
        span.style.fontSize = (0.8 + 0.7 * c / max).toFixed(2) + 'rem';
        span.textContent = w;
        span.title = `Used in ${c} openers (${p})`;
        const small = document.createElement('small'); small.textContent = `${c} · ${p}`;
        span.append(small);
        el.append(span);
      }
      const note = document.createElement('p'); note.className = 'empty-note full'; note.textContent = view.openers.note;
      el.append(note);
    }

    $('topDays').innerHTML = '<thead><tr><th>Date</th><th>Swipes</th><th>Share</th><th>Matches</th></tr></thead><tbody>' +
      (view.topDays.length ? view.topDays.map(r => `<tr><td>${esc(r[0])}</td><td>${r[1]}</td><td>${r[3]}</td><td>${r[2]}</td></tr>`).join('')
        : '<tr><td colspan="4">No swipes in this period.</td></tr>') + '</tbody>';

    const cols = [['Likes', 'likes'], ['Passes', 'passes'], ['Super Likes', 'superlikes'], ['Matches', 'matches'], ['Sent', 'sent'], ['Received', 'received'], ['Opens', 'opens']];
    const { labels, vals, extras } = view.table;
    const xk = Object.keys(extras);
    $('monthTable').innerHTML = `<thead><tr><th>Month</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}${xk.map(k => `<th>${esc(pretty(k))}</th>`).join('')}<th>Like rate</th><th>Match rate</th></tr></thead><tbody>` +
      vals.map((v, i) => `<tr><td>${labels[i]}</td>${cols.map(c => `<td>${n(v[c[1]])}</td>`).join('')}${xk.map(k => `<td>${n(extras[k][i])}</td>`).join('')}` +
        `<td>${pct(v.likes, v.likes + v.passes)}</td><td>${pct(v.matches, v.likes)}</td></tr>`).reverse().join('') +
      '</tbody>';
  }

  function profileChips() {
    const u = data.user || {};
    const chips = [];
    if (u.birth_date) {
      const age = Math.floor((Date.now() - new Date(u.birth_date)) / 31557600000);
      if (age > 0 && age < 120) chips.push(['Age', String(age)]);
    }
    if (u.create_date) {
      const d = String(u.create_date).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) chips.push(['Member since', fmtDate(d)]);
    }
    const g = { M: 'Man', F: 'Woman', M_F: 'Everyone' };
    if (u.gender) chips.push(['Gender', String(g[u.gender] || u.gender)]);
    if (u.interested_in) chips.push(['Interested in', String({ M: 'Men', F: 'Women', M_F: 'Everyone' }[u.interested_in] || u.interested_in)]);
    if (u.age_filter_min && u.age_filter_max) chips.push(['Age filter', `${u.age_filter_min}–${u.age_filter_max}`]);
    if (u.city && u.city.name) chips.push(['City', String(u.city.name)]);
    return chips;
  }

  // ---------- Extra usage charts (any series Tinder adds that we don't chart by name) ----------
  function buildExtraCharts() {
    const host = $('moreCharts');
    host.replaceChildren();
    const keys = Object.keys(data.extras || {});
    const metas = keys.map((k, i) => ({ key: 'x:' + k, id: 'chX' + i, group: 'More activity', title: pretty(k) + ' per month', sub: 'Labels show each month\'s share of the total', wide: keys.length === 1 }));
    for (const m of metas) {
      const fig = document.createElement('figure');
      fig.className = 'card chart-card' + (m.wide ? ' wide' : '');
      const cap = document.createElement('figcaption');
      const h = document.createElement('h3'); h.textContent = m.title;
      const p = document.createElement('p'); p.className = 'muted'; p.textContent = m.sub;
      cap.append(h, p);
      const box = document.createElement('div'); box.className = 'chart-box';
      const cv = document.createElement('canvas'); cv.id = m.id;
      box.append(cv);
      fig.append(cap, box);
      host.append(fig);
    }
    $('moreSection').hidden = !metas.length;
    CHARTS = BASE_CHARTS.concat(metas);
  }

  // ---------- Conversations browser (all messages in the export) ----------
  let convoShown = CONVO_PAGE;
  function renderConversations() {
    convoShown = CONVO_PAGE;
    $('convoSearch').value = '';
    const all = data.conversations;
    const msgs = all.reduce((s, c) => s + c.messages.length, 0);
    const withMsgs = all.filter(c => c.messages.length).length;
    const longest = all.reduce((m, c) => Math.max(m, c.messages.length), 0);
    $('convoSummary').textContent = all.length
      ? `${n(all.length)} matches in your export · ${n(withMsgs)} (${pct(withMsgs, all.length)}) with messages from you · ${n(msgs)} messages sent · longest: ${n(longest)} messages`
      : 'Your export has no conversations.';
    drawConvoList();
  }

  function drawConvoList() {
    const q = $('convoSearch').value.trim().toLowerCase();
    const totalMsgs = data.conversations.reduce((s, c) => s + c.messages.length, 0);
    let list = data.conversations.filter(c => c.messages.length || !q);
    if (q) list = list.filter(c => c.id.toLowerCase().includes(q) || c.messages.some(m => m.text.toLowerCase().includes(q)));
    list = list.slice().sort((a, b) => b.messages.length - a.messages.length);
    const host = $('convoList');
    host.replaceChildren();
    if (!list.length) {
      const p = document.createElement('p'); p.className = 'empty-note'; p.textContent = q ? 'No messages match your search.' : 'No conversations.';
      host.append(p);
    }
    for (const c of list.slice(0, convoShown)) {
      const d = document.createElement('details'); d.className = 'convo';
      const s = document.createElement('summary');
      const name = document.createElement('b'); name.textContent = c.id || 'Match';
      const meta = document.createElement('span'); meta.className = 'convo-meta';
      const first = c.messages[0], last = c.messages[c.messages.length - 1];
      meta.textContent = c.messages.length
        ? `${n(c.messages.length)} messages (${pct(c.messages.length, totalMsgs)} of all) · ${fmtDT(first.date, false)} – ${fmtDT(last.date, false)}`
        : 'No messages from you';
      s.append(name, meta);
      d.append(s);
      d.addEventListener('toggle', () => {
        if (!d.open || d.dataset.filled) return;
        d.dataset.filled = '1';
        const ul = document.createElement('ul'); ul.className = 'msgs';
        for (const m of c.messages) {
          const li = document.createElement('li');
          const t = document.createElement('time'); t.textContent = fmtDT(m.date, true);
          const p = document.createElement('p'); p.textContent = m.text || '(no text, such as a GIF or sticker)';
          if (q && m.text.toLowerCase().includes(q)) li.className = 'hit';
          li.append(t, p); ul.append(li);
        }
        d.append(ul);
      });
      host.append(d);
    }
    $('convoMore').hidden = list.length <= convoShown;
    $('convoMore').textContent = `Show more conversations (${n(list.length - convoShown)} more)`;
  }
  let searchTimer;
  $('convoSearch').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { convoShown = CONVO_PAGE; drawConvoList(); }, 200); });
  $('convoMore').addEventListener('click', () => { convoShown += CONVO_PAGE; drawConvoList(); });

  // ---------- Every other section of the export, rendered generically ----------
  function renderAllSections() {
    const host = $('allSections');
    host.replaceChildren();
    const secs = [['Profile', data.user], ...Object.entries(data.sections || {})];
    for (const [name, val] of secs) {
      if (val == null || (typeof val === 'object' && !Object.keys(val).length)) continue;
      const card = document.createElement('details'); card.className = 'card data-section';
      if (name === 'Profile') card.open = true;
      const sum = document.createElement('summary');
      const h = document.createElement('h3'); h.textContent = pretty(name);
      const cnt = document.createElement('span'); cnt.className = 'convo-meta';
      cnt.textContent = Array.isArray(val) ? `${n(val.length)} items` : (typeof val === 'object' ? `${n(Object.keys(val).length)} fields` : '');
      sum.append(h, cnt);
      card.append(sum, renderValue(val, 0));
      host.append(card);
    }
    if (!host.children.length) {
      const p = document.createElement('p'); p.className = 'empty-note'; p.textContent = 'Your export has no other sections.';
      host.append(p);
    }
  }

  const MAX_ITEMS = 300;
  function renderValue(v, depth) {
    if (v == null || v === '') return textEl('span', '–', 'kv-empty');
    if (typeof v !== 'object') return textEl('span', prettyScalar(v), 'kv-val');
    if (depth > 6) return textEl('span', JSON.stringify(v).slice(0, 500), 'kv-val');
    if (Array.isArray(v)) {
      if (!v.length) return textEl('span', 'none', 'kv-empty');
      if (v.every(x => x == null || typeof x !== 'object')) {
        const wrap = document.createElement('div'); wrap.className = 'kv-chips';
        for (const x of v.slice(0, MAX_ITEMS)) wrap.append(textEl('span', prettyScalar(x), 'kv-chip'));
        if (v.length > MAX_ITEMS) wrap.append(textEl('span', `+${n(v.length - MAX_ITEMS)} more`, 'kv-empty'));
        return wrap;
      }
      const ol = document.createElement('ol'); ol.className = 'kv-list';
      for (const x of v.slice(0, MAX_ITEMS)) { const li = document.createElement('li'); li.append(renderValue(x, depth + 1)); ol.append(li); }
      if (v.length > MAX_ITEMS) ol.append(textEl('li', `+${n(v.length - MAX_ITEMS)} more items`, 'kv-empty'));
      return ol;
    }
    const dl = document.createElement('dl'); dl.className = 'kv';
    const entries = Object.entries(v);
    for (const [k, x] of entries.slice(0, MAX_ITEMS)) {
      dl.append(textEl('dt', pretty(k)));
      const dd = document.createElement('dd'); dd.append(renderValue(x, depth + 1)); dl.append(dd);
    }
    if (entries.length > MAX_ITEMS) dl.append(textEl('dd', `+${n(entries.length - MAX_ITEMS)} more fields`, 'kv-empty'));
    return dl;
  }
  function textEl(tag, txt, cls) { const e = document.createElement(tag); e.textContent = txt; if (cls) e.className = cls; return e; }
  function prettyScalar(x) {
    if (typeof x === 'boolean') return x ? 'Yes' : 'No';
    if (typeof x === 'number') return x.toLocaleString();
    const s = String(x);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) { const d = new Date(s); if (!isNaN(d)) return d.toLocaleString(); }
    return s;
  }
  function pretty(k) {
    const s = String(k).replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function fmtDT(d, withTime) {
    return d.toLocaleString(undefined, withTime ? { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } : { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // ---------- Helpers ----------
  function n(x) { return Number(x || 0).toLocaleString(); }
  function pct(a, b) {
    if (!b) return '–';
    const p = a / b * 100;
    return (p < 10 ? p.toFixed(1) : Math.round(p)) + '%';
  }
  function fmtDate(d, withWeekday) {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', ...(withWeekday ? { weekday: 'short' } : {}) });
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (data) render(); });

  window.SwipeApp = { getView: () => view, get CHARTS() { return CHARTS; }, ICONS };
})();
