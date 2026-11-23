(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const STOPWORDS = new Set(('a an the and or but so to of in on at for with is are was were be been am i im i\'m you your you\'re ' +
    'me my we it its it\'s this that what how do does did have has had not no yes just like can could would will ' +
    'u ur r there here they them he she his her if as by from up out about any some too very really').split(' '));

  // Every chart on the dashboard; the export dialog uses the same list.
  const CHARTS = [
    { key: 'swipes', id: 'chSwipes', group: 'Swiping', title: 'Likes and passes per month', sub: '', wide: true },
    { key: 'likeRate', id: 'chLikeRate', group: 'Swiping', title: 'Like rate per month', sub: 'Share of swipes that were right swipes' },
    { key: 'weekday', id: 'chWeekday', group: 'Swiping', title: 'Average swipes by weekday', sub: 'On days you swiped' },
    { key: 'matches', id: 'chMatches', group: 'Matching', title: 'Matches per month', sub: '' },
    { key: 'matchRate', id: 'chMatchRate', group: 'Matching', title: 'Match rate per month', sub: 'Matches divided by likes sent' },
    { key: 'messages', id: 'chMessages', group: 'Messaging', title: 'Messages sent and received per month', sub: '', wide: true },
    { key: 'hour', id: 'chHour', group: 'Messaging', title: 'When you send messages', sub: 'By hour of day, in your local time' },
    { key: 'convo', id: 'chConvo', group: 'Messaging', title: 'Conversation length', sub: 'Messages you sent per match' },
    { key: 'opens', id: 'chOpens', group: 'App usage', title: 'App opens per month', sub: '', wide: true },
  ];

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

    const charts = {
      swipes: { type: 'bar', labels: mLabels, opts: { stacked: true }, datasets: [
        { label: 'Likes', data: mVals.map(v => v.likes) }, { label: 'Passes', data: mVals.map(v => v.passes) }] },
      likeRate: { type: 'line', labels: mLabels, opts: { percent: true }, datasets: [
        { label: 'Like rate', data: mVals.map(v => (v.likes + v.passes) ? v.likes / (v.likes + v.passes) : null) }] },
      weekday: { type: 'bar', labels: WEEKDAYS, datasets: [{ label: 'Avg swipes', data: wd.map(x => x.c ? Math.round(x.s / x.c) : 0) }] },
      matches: { type: 'bar', labels: mLabels, datasets: [{ label: 'Matches', data: mVals.map(v => v.matches) }] },
      matchRate: { type: 'line', labels: mLabels, opts: { percent: true }, datasets: [
        { label: 'Match rate', data: mVals.map(v => v.likes ? v.matches / v.likes : null) }] },
      messages: { type: 'line', labels: mLabels, datasets: [
        { label: 'Sent', data: mVals.map(v => v.sent) }, { label: 'Received', data: mVals.map(v => v.received) }] },
      hour: { type: 'bar', labels: hours.map((_, h) => h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : (h - 12) + 'p'),
        datasets: [{ label: 'Messages', data: hours }] },
      convo: { type: 'bar', labels: buckets.map(b => b[0]), opts: { xTitle: 'messages sent' },
        datasets: [{ label: 'Matches', data: buckets.map(([, lo, hi]) => convos.filter(c => c.messages.length >= lo && c.messages.length <= hi).length) }] },
      opens: { type: 'bar', labels: mLabels, datasets: [{ label: 'App opens', data: mVals.map(v => v.opens) }] },
    };

    // Opening words
    const counts = new Map();
    let questions = 0;
    for (const c of withMsgs) {
      const t = c.messages[0].text;
      if (t.includes('?')) questions++;
      const words = new Set(t.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, ' ').split(/\s+/).filter(w => w.length > 1 && !STOPWORDS.has(w)));
      for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
    }
    const topWords = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
    const avgLen = withMsgs.length ? Math.round(withMsgs.reduce((s, c) => s + c.messages[0].text.length, 0) / withMsgs.length) : 0;
    const openersNote = withMsgs.length ? `${pct(questions, withMsgs.length)} of your openers asked a question · average opener is ${avgLen} characters` : '';

    const topDays = days.map(([d, v]) => [d, v.likes + v.passes, v.matches]).filter(x => x[1])
      .sort((a, b) => b[1] - a[1]).slice(0, 6).map(([d, s, m]) => [fmtDate(d, true), n(s), n(m)]);

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
      table: { labels: mLabels, vals: mVals },
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

    for (const c of CHARTS) Charts.show(c.id, view.charts[c.key]);

    // Opening words (DOM APIs, no inline style attributes, so the CSP can stay strict)
    const el = $('openerWords');
    el.replaceChildren();
    const words = view.openers.words;
    if (!words.length) {
      const p = document.createElement('p'); p.className = 'empty-note'; p.textContent = 'No messages in this period.'; el.append(p);
    } else {
      const max = words[0][1];
      for (const [w, c] of words) {
        const span = document.createElement('span');
        span.className = 'word';
        span.style.fontSize = (0.8 + 0.7 * c / max).toFixed(2) + 'rem';
        span.textContent = w;
        const small = document.createElement('small'); small.textContent = c;
        span.append(small);
        el.append(span);
      }
      const note = document.createElement('p'); note.className = 'empty-note full'; note.textContent = view.openers.note;
      el.append(note);
    }

    $('topDays').innerHTML = '<thead><tr><th>Date</th><th>Swipes</th><th>Matches</th></tr></thead><tbody>' +
      (view.topDays.length ? view.topDays.map(r => `<tr><td>${esc(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')
        : '<tr><td colspan="3">No swipes in this period.</td></tr>') + '</tbody>';

    const cols = [['Likes', 'likes'], ['Passes', 'passes'], ['Matches', 'matches'], ['Sent', 'sent'], ['Received', 'received'], ['Opens', 'opens']];
    const { labels, vals } = view.table;
    $('monthTable').innerHTML = `<thead><tr><th>Month</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}<th>Match rate</th></tr></thead><tbody>` +
      vals.map((v, i) => `<tr><td>${labels[i]}</td>${cols.map(c => `<td>${n(v[c[1]])}</td>`).join('')}<td>${v.likes ? pct(v.matches, v.likes) : '–'}</td></tr>`).reverse().join('') +
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

  window.SwipeApp = { getView: () => view, CHARTS, ICONS };
})();
