(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const STOPWORDS = new Set(('a an the and or but so to of in on at for with is are was were be been am i im i\'m you your you\'re ' +
    'me my we it its it\'s this that what how do does did have has had not no yes just like can could would will ' +
    'u ur r there here they them he she his her if as by from up out about any some too very really').split(' '));

  let data = null;
  let range = 'all';

  // ---------- Upload ----------
  const dropZone = $('dropZone');
  const fileInput = $('fileInput');

  fileInput.addEventListener('change', () => { if (fileInput.files[0]) load(fileInput.files[0]); });
  ['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.remove('dragging'); }));
  dropZone.addEventListener('drop', ev => { const f = ev.dataTransfer.files[0]; if (f) load(f); });
  // Prevent the browser from opening the file if dropped outside the zone
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => e.preventDefault());

  $('demoBtn').addEventListener('click', () => show(TinderParse.normalize(TinderDemo.makeDemo()), true));
  $('resetBtn').addEventListener('click', () => {
    data = null;
    Charts.destroyAll();
    fileInput.value = '';
    $('dashView').hidden = true;
    $('uploadView').hidden = false;
    $('resetBtn').hidden = true;
    window.scrollTo(0, 0);
  });
  $('rangeSelect').addEventListener('change', e => { range = e.target.value; render(); });

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
    data = parsed;
    data.isDemo = isDemo;
    const dates = Object.keys(data.days).sort();
    if (!dates.length) {
      $('uploadError').textContent = 'No activity was found in this file.';
      $('uploadError').hidden = false;
      return;
    }
    // Build period options: all time + each year
    const years = [...new Set(dates.map(d => d.slice(0, 4)))];
    const sel = $('rangeSelect');
    sel.innerHTML = '<option value="all">All time</option><option value="12m">Last 12 months</option>' +
      years.reverse().map(y => `<option value="${y}">${y}</option>`).join('');
    range = 'all';
    sel.value = 'all';

    $('uploadView').hidden = true;
    $('dashView').hidden = false;
    $('resetBtn').hidden = false;
    $('dashTitle').textContent = isDemo ? 'Sample dashboard' : 'Your Tinder, in numbers';
    renderProfile();
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
      return dateStr > cut.toISOString().slice(0, 10);
    }
    return dateStr.startsWith(range);
  }

  function filteredDays() {
    return Object.entries(data.days).filter(([d]) => inRange(d)).sort((a, b) => a[0] < b[0] ? -1 : 1);
  }

  function localDateKey(dt) {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  // ---------- Rendering ----------
  function render() {
    const days = filteredDays();
    const totals = TinderParse.blankDay();
    for (const [, v] of days) for (const k in totals) totals[k] += v[k];

    // Monthly buckets, filling gaps so the timeline is continuous
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

    // Conversations in range (by date of first message)
    const convos = data.conversations.map(c => ({ ...c, messages: c.messages.filter(m => inRange(localDateKey(m.date))) }));
    const withMsgs = convos.filter(c => c.messages.length);
    const sentMsgs = withMsgs.flatMap(c => c.messages);

    const activeDays = days.filter(([, v]) => v.opens || v.likes || v.passes).length;
    const swipes = totals.likes + totals.passes;

    // Subtitle
    const firstDay = days[0]?.[0], lastDay = days[days.length - 1]?.[0];
    $('dashSub').textContent = firstDay
      ? `${fmtDate(firstDay)} to ${fmtDate(lastDay)} · ${activeDays.toLocaleString()} active days` + (data.isDemo ? ' · generated sample data' : '')
      : 'No activity in this period.';

    // KPIs
    const kpis = [
      ['Matches', n(totals.matches), `${pct(totals.matches, totals.likes)} of your likes`],
      ['Swipes', n(swipes), `${n(Math.round(swipes / Math.max(activeDays, 1)))} per active day`],
      ['Like rate', pct(totals.likes, swipes), `${n(totals.likes)} likes, ${n(totals.passes)} passes`],
      ['Swipes per match', totals.matches ? n(Math.round(swipes / totals.matches)) : '–', 'right and left swipes combined'],
      ['App opens', n(totals.opens), `${n(Math.round(totals.opens / Math.max(activeDays, 1)))} per active day`],
      ['Messages sent', n(totals.sent), `${n(totals.received)} received`],
      ['Conversations started', n(withMsgs.length), `${pct(withMsgs.length, convos.length)} of matches you messaged`],
      ['Super Likes', n(totals.superlikes), totals.superlikes ? `${n(Math.round(totals.likes / totals.superlikes))} likes per Super Like` : 'none used'],
    ];
    $('kpis').innerHTML = kpis.map(([label, value, note]) =>
      `<div class="card kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-note">${note}</div></div>`).join('');

    // Swipes
    Charts.legend('swipes', ['Likes', 'Passes']);
    Charts.bar('chSwipes', mLabels, [
      { label: 'Likes', data: mVals.map(v => v.likes) },
      { label: 'Passes', data: mVals.map(v => v.passes) },
    ], { stacked: true });
    Charts.line('chLikeRate', mLabels, [
      { label: 'Like rate', data: mVals.map(v => (v.likes + v.passes) ? v.likes / (v.likes + v.passes) : null) },
    ], { percent: true });

    // Weekday averages (over active days only)
    const wd = WEEKDAYS.map(() => ({ s: 0, c: 0 }));
    for (const [d, v] of days) {
      if (!(v.likes + v.passes)) continue;
      const i = (new Date(d + 'T12:00:00').getDay() + 6) % 7;
      wd[i].s += v.likes + v.passes; wd[i].c++;
    }
    Charts.bar('chWeekday', WEEKDAYS, [{ label: 'Avg swipes', data: wd.map(x => x.c ? Math.round(x.s / x.c) : 0) }]);

    // Matching
    Charts.bar('chMatches', mLabels, [{ label: 'Matches', data: mVals.map(v => v.matches) }]);
    Charts.line('chMatchRate', mLabels, [
      { label: 'Match rate', data: mVals.map(v => v.likes ? v.matches / v.likes : null) },
    ], { percent: true });

    // Messaging
    Charts.legend('messages', ['Sent', 'Received']);
    Charts.line('chMessages', mLabels, [
      { label: 'Sent', data: mVals.map(v => v.sent) },
      { label: 'Received', data: mVals.map(v => v.received) },
    ]);

    const hours = new Array(24).fill(0);
    for (const m of sentMsgs) hours[m.date.getHours()]++;
    Charts.bar('chHour', hours.map((_, h) => h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : (h - 12) + 'p'),
      [{ label: 'Messages', data: hours }]);

    const buckets = [['0', 0, 0], ['1', 1, 1], ['2–5', 2, 5], ['6–10', 6, 10], ['11–25', 11, 25], ['26–50', 26, 50], ['51+', 51, Infinity]];
    Charts.bar('chConvo', buckets.map(b => b[0]),
      [{ label: 'Matches', data: buckets.map(([, lo, hi]) => convos.filter(c => c.messages.length >= lo && c.messages.length <= hi).length) }],
      { xTitle: 'messages sent' });

    renderOpeners(withMsgs);
    renderTopDays(days);
    Charts.bar('chOpens', mLabels, [{ label: 'App opens', data: mVals.map(v => v.opens) }]);
    renderMonthTable(mKeys, mLabels, mVals);
  }

  function renderProfile() {
    const u = data.user || {};
    const chips = [];
    if (u.birth_date) {
      const age = Math.floor((Date.now() - new Date(u.birth_date)) / 31557600000);
      if (age > 0 && age < 120) chips.push(['Age', age]);
    }
    if (u.create_date) chips.push(['Member since', fmtDate(String(u.create_date).slice(0, 10))]);
    const g = { M: 'Man', F: 'Woman', M_F: 'Everyone' };
    if (u.gender) chips.push(['Gender', g[u.gender] || u.gender]);
    if (u.interested_in) chips.push(['Interested in', { M: 'Men', F: 'Women', M_F: 'Everyone' }[u.interested_in] || u.interested_in]);
    if (u.age_filter_min && u.age_filter_max) chips.push(['Age filter', `${u.age_filter_min}–${u.age_filter_max}`]);
    if (u.city && u.city.name) chips.push(['City', u.city.name]);
    $('profile').innerHTML = chips.map(([k, v]) => `<span class="chip">${esc(k)}: <b>${esc(String(v))}</b></span>`).join('');
  }

  function renderOpeners(withMsgs) {
    const counts = new Map();
    let questions = 0;
    for (const c of withMsgs) {
      const t = c.messages[0].text;
      if (t.includes('?')) questions++;
      const words = new Set(t.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, ' ').split(/\s+/).filter(w => w.length > 1 && !STOPWORDS.has(w)));
      for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
    const el = $('openerWords');
    if (!top.length) { el.innerHTML = '<p class="empty-note">No messages in this period.</p>'; return; }
    const max = top[0][1];
    const avgLen = Math.round(withMsgs.reduce((s, c) => s + c.messages[0].text.length, 0) / withMsgs.length);
    el.innerHTML = top.map(([w, c]) =>
      `<span class="word" style="font-size:${(0.8 + 0.7 * c / max).toFixed(2)}rem">${esc(w)}<small>${c}</small></span>`).join('') +
      `<p class="empty-note" style="width:100%">${pct(questions, withMsgs.length)} of your openers asked a question · average opener is ${avgLen} characters</p>`;
  }

  function renderTopDays(days) {
    const top = days.map(([d, v]) => [d, v.likes + v.passes, v.matches]).filter(x => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 6);
    $('topDays').innerHTML = '<thead><tr><th>Date</th><th>Swipes</th><th>Matches</th></tr></thead><tbody>' +
      (top.length ? top.map(([d, s, m]) => `<tr><td>${fmtDate(d, true)}</td><td>${n(s)}</td><td>${n(m)}</td></tr>`).join('')
        : '<tr><td colspan="3">No swipes in this period.</td></tr>') + '</tbody>';
  }

  function renderMonthTable(keys, labels, vals) {
    const cols = [['Likes', 'likes'], ['Passes', 'passes'], ['Matches', 'matches'], ['Sent', 'sent'], ['Received', 'received'], ['Opens', 'opens']];
    $('monthTable').innerHTML = `<thead><tr><th>Month</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}<th>Match rate</th></tr></thead><tbody>` +
      vals.map((v, i) => `<tr><td>${labels[i]}</td>${cols.map(c => `<td>${n(v[c[1]])}</td>`).join('')}<td>${v.likes ? pct(v.matches, v.likes) : '–'}</td></tr>`).reverse().join('') +
      '</tbody>';
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
  function esc(s) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // Re-draw charts with the right colors when the OS theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (data) render(); });
})();
