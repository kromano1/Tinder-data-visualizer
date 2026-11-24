(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
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
    calendar: '<path d="M4 6h16v14H4zM4 10h16M8 3v5M16 3v5"/>',
    clock: '<path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 20h8M10 17h4"/>',
    quote: '<path d="M6 17c2-1 3-3 3-6H5V6h5v5c0 4-2 6-4 7zM15 17c2-1 3-3 3-6h-4V6h5v5c0 4-2 6-4 7z"/>',
    flame: '<path d="M12 21c-3.9 0-6-2.6-6-5.6 0-3.4 3-5.4 3-8.4 2 1 3.5 3 3.5 5 1-1 1.5-2.3 1.5-3.5 2.2 1.7 4 4.3 4 6.9 0 3-2.1 5.6-6 5.6z"/>',
    ruler: '<path d="M3 16l13-13 5 5L8 21zM7 12l2 2M10 9l2 2M13 6l2 2"/>',
  };

  let data = null;
  let range = 'all';
  // How matches are counted: 'export' = matches still listed in the file (default), 'log' = all-time activity log
  const MODE_KEY = 'swipestats.matchMode';
  let matchMode = 'export';
  try { matchMode = localStorage.getItem(MODE_KEY) === 'log' ? 'log' : 'export'; } catch (e) { /* storage unavailable */ }
  const exportMode = () => matchMode === 'export' && data && data.conversations.length > 0;
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
    $('topNav').hidden = true;
    window.scrollTo(0, 0);
  });
  $('rangeSelect').addEventListener('change', e => {
    range = e.target.value;
    $('customRange').hidden = range !== 'custom';
    render();
  });
  function applyMatchModeUI() {
    const hasFile = data && data.conversations.length > 0;
    $('matchMode').hidden = !hasFile;
    const ex = exportMode();
    for (const b of document.querySelectorAll('#matchMode button')) b.setAttribute('aria-pressed', String(b.dataset.mode === (ex ? 'export' : 'log')));
    $('modeNote').hidden = !ex;
    $('periodGroup').hidden = ex;
    if (ex) { range = 'all'; $('rangeSelect').value = 'all'; $('customRange').hidden = true; }
  }
  $('matchMode').addEventListener('click', e => {
    const b = e.target.closest('button[data-mode]');
    if (!b || !data || b.dataset.mode === matchMode) return;
    matchMode = b.dataset.mode;
    try { localStorage.setItem(MODE_KEY, matchMode); } catch (err) { /* storage unavailable */ }
    applyMatchModeUI();
    render();
  });
  for (const id of ['rangeFrom', 'rangeTo']) {
    $(id).addEventListener('change', () => { if (range === 'custom') render(); });
  }
  $('exportBtn').addEventListener('click', () => ExportReport.open());
  $('exportBtnTop').addEventListener('click', () => ExportReport.open());

  async function load(file) {
    const err = $('uploadError');
    err.hidden = true;
    dropZone.classList.add('loading');
    try {
      const parsed = await TinderParse.readFile(file);
      parsed.fileInfo = { name: file.name, size: file.size };
      show(parsed, false);
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
    sel.innerHTML = '<option value="all">Entire export</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option>' +
      '<option value="12m">Last 12 months</option>' +
      years.reverse().map(y => `<option value="${y}">${y}</option>`).join('') +
      '<option value="custom">Custom range…</option>';
    range = 'all';
    sel.value = 'all';
    // Custom range is limited to the dates in this export
    const f = $('rangeFrom'), t = $('rangeTo');
    f.min = t.min = dates[0]; f.max = t.max = dates[dates.length - 1];
    f.value = dates[0]; t.value = dates[dates.length - 1];
    $('customRange').hidden = true;
    $('topNav').hidden = false;
    applyMatchModeUI();

    $('uploadView').hidden = true;
    $('dashView').hidden = false;
    $('resetBtn').hidden = false;
    $('exportBtnTop').hidden = false;
    $('dashEyebrow').textContent = isDemo ? 'Sample data' : 'Your Tinder, in numbers';
    buildExtraCharts();
    renderConversations();
    renderAllSections();
    exportOv = computeExportOverview();
    renderExportOverview();
    render();
    window.scrollTo(0, 0);
  }

  // ---------- Filtering ----------
  // Returns [from, to] (inclusive YYYY-MM-DD) for the selected period, or null for the entire export.
  // Relative ranges count back from the last day in the export, not from today.
  function bounds() {
    if (range === 'all') return null;
    const last = Object.keys(data.days).sort().pop();
    const back = (days, months) => {
      const d = new Date(last + 'T00:00:00');
      if (months) d.setMonth(d.getMonth() - months); else d.setDate(d.getDate() - days);
      d.setDate(d.getDate() + 1);
      return [localDateKey(d), last];
    };
    if (range === '30d') return back(30);
    if (range === '90d') return back(90);
    if (range === '12m') return back(0, 12);
    if (range === 'custom') {
      let a = $('rangeFrom').value || $('rangeFrom').min, b = $('rangeTo').value || $('rangeTo').max;
      if (a > b) [a, b] = [b, a];
      return [a, b];
    }
    return [range + '-01-01', range + '-12-31'];
  }
  let curBounds = null;
  function inRange(dateStr) {
    return !curBounds || (dateStr >= curBounds[0] && dateStr <= curBounds[1]);
  }

  function localDateKey(dt) {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  // ---------- Compute everything for the current period ----------
  function compute() {
    curBounds = bounds();
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
    const periodLabel = range === 'custom' && curBounds
      ? `${fmtDate(curBounds[0])} – ${fmtDate(curBounds[1])}`
      : ($('rangeSelect').selectedOptions[0]?.textContent || 'Entire export');

    // Most important stats: a big percentage with the real numbers underneath
    const spanDays = firstDay ? Math.round((new Date(lastDay) - new Date(firstDay)) / 86400000) + 1 : 0;
    const matchDays = days.filter(([, v]) => v.matches > 0).length;
    const msgTotal = totals.sent + totals.received;
    const questionsN = withMsgs.filter(c => c.messages[0].text.includes('?')).length;
    const allTime = range === 'all' && exportOv && exportOv.total;
    // The match count every match-based percentage uses
    const ex = exportMode();
    const M = ex ? data.conversations.length : totals.matches;
    const mWord = ex ? 'matches still in your export' : 'matches';
    // Matches in the file have no date, so for a period compare against the matches made in that period
    const msgBase = range === 'all' ? convos.length : Math.max(totals.matches, withMsgs.length);
    const headline = [
      { label: 'Match rate', value: pct(M, totals.likes), note: `${n(M)} ${ex ? 'matches in your export' : 'matches'} from ${n(totals.likes)} likes` },
      { label: 'Like rate', value: pct(totals.likes, swipes), note: `${n(totals.likes)} of ${n(swipes)} swipes` },
      { label: 'Matches you messaged', value: pct(withMsgs.length, msgBase), note: `${n(withMsgs.length)} of ${n(msgBase)} matches` },
      allTime
        ? { label: 'Matches still in your export', value: pct(exportOv.inFile, exportOv.total), note: `${n(exportOv.inFile)} of ${n(exportOv.total)} all-time matches` }
        : { label: 'Messages sent by you', value: pct(totals.sent, msgTotal), note: `${n(totals.sent)} sent · ${n(totals.received)} received` },
    ];
    const kpis = [
      allTime
        ? { label: 'Messages sent by you', value: pct(totals.sent, msgTotal), note: `${n(totals.sent)} sent · ${n(totals.received)} received`, icon: 'chat', c: 'c2' }
        : { label: 'Openers with a question', value: pct(questionsN, withMsgs.length), note: `${n(questionsN)} of ${n(withMsgs.length)} first messages`, icon: 'quote', c: 'c2' },
      { label: 'Active days', value: pct(activeDays, spanDays), note: `${n(activeDays)} of ${n(spanDays)} days · ${n(totals.opens)} app opens`, icon: 'calendar', c: 'c1' },
      { label: 'Days with a match', value: pct(matchDays, activeDays), note: `${n(matchDays)} of ${n(activeDays)} active days${ex ? ' (activity log)' : ''}`, icon: 'heart', c: 'c3' },
      { label: 'Super Likes', value: pct(totals.superlikes, totals.likes), note: `${n(totals.superlikes)} of your ${n(totals.likes)} likes`, icon: 'star', c: 'c1' },
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

    // ---------- Plain-English story + one-line takeaways ----------
    const fullM = i => mKeys[i] ? `${FULL_MONTHS[+mKeys[i].slice(5) - 1]} ${mKeys[i].slice(0, 4)}` : '';
    const peakIdx = arr => { let bi = -1, bv = -Infinity; arr.forEach((v, i) => { if (v != null && v > bv) { bv = v; bi = i; } }); return bv > 0 ? bi : -1; };
    const lowIdx = arr => { let bi = -1, bv = Infinity; arr.forEach((v, i) => { if (v != null && v < bv) { bv = v; bi = i; } }); return bi; };
    const hourName = h => h === 0 ? '12 am' : h < 12 ? `${h} am` : h === 12 ? '12 pm' : `${h - 12} pm`;
    const mMatches = mVals.map(v => v.matches);
    const story = [];
    if (M && totals.likes) story.push({ icon: 'heart', c: 'c2', big: `1 in ${n(Math.max(1, Math.round(totals.likes / M)))}`, text: ex ? 'of your likes became a match that\'s still in your export' : 'of your likes turned into a match' });
    if (swipes) story.push({ icon: 'swipe', c: 'c1', big: pct(totals.likes, swipes), text: `of profiles got a right swipe from you. You passed on the other ${pct(totals.passes, swipes)}.` });
    const wdTop = peakIdx(wdAvg);
    if (wdTop >= 0) story.push({ icon: 'calendar', c: 'c3', big: FULL_DAYS[wdTop] + 's', text: `are your busiest swiping days, with ${pct(wdAvg[wdTop], wdAvg.reduce((a, b) => a + b, 0))} of a typical week's swipes` });
    const bestM = peakIdx(mMatches);
    if (bestM >= 0) story.push({ icon: 'trophy', c: 'c2', big: fullM(bestM), text: `was your best month: ${n(mMatches[bestM])} matches, ${pct(mMatches[bestM], totals.matches)} of ${ex ? 'all logged matches' : 'the total'}` });
    if (msgBase) story.push({ icon: 'chat', c: 'c1', big: pct(withMsgs.length, msgBase), text: `of your matches got a message from you. ${n(msgBase - withMsgs.length)} never heard from you.` });
    const hTop = peakIdx(hours);
    if (hTop >= 0) story.push({ icon: 'clock', c: 'c3', big: hourName(hTop), text: `is your favorite time to text: ${pct(hours[hTop], sentMsgs.length)} of your messages go out in that hour` });
    const busiest = days.reduce((b, d) => (d[1].likes + d[1].passes) > (b ? b[1].likes + b[1].passes : 0) ? d : b, null);
    if (busiest) story.push({ icon: 'flame', c: 'c2', big: n(busiest[1].likes + busiest[1].passes), text: `swipes on ${fmtDate(busiest[0], true)}, your busiest day ever` });
    if (topWords.length) story.push({ icon: 'quote', c: 'c1', big: `"${topWords[0][0]}"`, text: `is your go-to opener word, used in ${topWords[0][2]} of your first messages` });
    const longest = withMsgs.reduce((m, c) => Math.max(m, c.messages.length), 0);
    if (longest) story.push({ icon: 'ruler', c: 'c3', big: n(longest), text: `messages in your longest conversation. The average is ${n(Math.round(sentMsgs.length / withMsgs.length))}.` });
    else if (totals.opens) story.push({ icon: 'phone', c: 'c3', big: n(Math.round(totals.opens / Math.max(activeDays, 1))), text: 'app opens on a typical active day' });

    const i0 = arr => arr.some(v => v != null);
    const avgOf = arr => { const v = arr.filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const tk = {};
    { const i = peakIdx(mVals.map(v => v.likes + v.passes)); tk.swipes = i >= 0 ? `You swiped most in ${fullM(i)} (${n(mVals[i].likes + mVals[i].passes)} swipes). Overall you liked ${pct(totals.likes, swipes)} of profiles.` : 'No swipes in this period.'; }
    { const i = peakIdx(likeRate), a = avgOf(likeRate); tk.likeRate = i >= 0 ? `You usually swiped right about ${Charts.fmtPct(a)} of the time, most often in ${fullM(i)} (${Charts.fmtPct(likeRate[i])}).` : 'No swipes in this period.'; }
    { const lo = lowIdx(wdAvg.map(v => v || null)); tk.weekday = wdTop >= 0 ? `${FULL_DAYS[wdTop]} is your busiest day${lo >= 0 && lo !== wdTop ? ` and ${FULL_DAYS[lo]} the quietest` : ''}.` : 'No swipes in this period.'; }
    { const arr = mVals.map(v => v.superlikes), i = peakIdx(arr); tk.super = i >= 0 ? `You used ${n(totals.superlikes)} Super Likes, the most in ${fullM(i)} (${n(arr[i])}).` : 'You didn\'t use any Super Likes in this period.'; }
    tk.matches = bestM >= 0 ? `Your best month was ${fullM(bestM)} with ${n(mMatches[bestM])} matches, ${pct(mMatches[bestM], totals.matches)} of the total.` : 'No matches in this period.';
    if (ex && totals.matches > M) tk.matches += ` Monthly counts come from the activity log, which still counts the ${n(totals.matches - M)} matches later removed from your export.`;
    { const i = peakIdx(matchRate), a = avgOf(matchRate); tk.matchRate = i >= 0 ? `On average ${Charts.fmtPct(a)} of your likes matched each month. ${fullM(i)} was your luckiest at ${Charts.fmtPct(matchRate[i])}.` : 'No likes in this period.'; }
    if (ex && i0(matchRate)) tk.matchRate += ` These monthly rates use the activity log; counting only matches still in your export, your overall rate is ${pct(M, totals.likes)}.`;
    { const i = peakIdx(mVals.map(v => v.sent + v.received)); tk.messages = i >= 0 ? `You sent ${n(totals.sent)} messages and received ${n(totals.received)}. ${fullM(i)} was your chattiest month.` : 'No messages in this period.'; }
    { const night = hours.slice(21).reduce((a, b) => a + b, 0) + hours.slice(0, 3).reduce((a, b) => a + b, 0); tk.hour = hTop >= 0 ? `You text most around ${hourName(hTop)}. ${pct(night, sentMsgs.length)} of your messages are sent between 9 pm and 3 am.` : 'No messages in this period.'; }
    { const none = convoCounts[0], longC = convoCounts.slice(4).reduce((a, b) => a + b, 0), tot = convoCounts.reduce((a, b) => a + b, 0); tk.convo = tot ? `${pct(none, tot)} of matches never got a message, and ${pct(longC, tot)} of conversations went past 10 messages.` : 'No matches in this period.'; }
    { const arr = mVals.map(v => v.opens), i = peakIdx(arr); tk.opens = i >= 0 ? `You opened the app ${n(totals.opens)} times, the most in ${fullM(i)} (${n(arr[i])}).` : 'No app opens in this period.'; }
    for (const [k, arr] of Object.entries(extraMonthly)) { const i = peakIdx(arr); tk['x:' + k] = i >= 0 ? `${n(arr.reduce((a, b) => a + b, 0))} in total, the most in ${fullM(i)} (${n(arr[i])}).` : 'Nothing in this period.'; }

    return {
      isDemo: data.isDemo,
      story, takeaways: tk,
      periodLabel,
      sub: curBounds
        ? `${fmtDate(curBounds[0])} – ${fmtDate(curBounds[1])} · ${activeDays.toLocaleString()} active days`
        : (firstDay ? `${fmtDate(firstDay)} – ${fmtDate(lastDay)} · ${activeDays.toLocaleString()} active days` : 'No activity in this period'),
      title: data.isDemo ? 'Sample dashboard' : (range === 'all' ? 'Your entire export' : periodLabel),
      headline,
      profile: profileChips(),
      kpis, charts, exportOv,
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

    $('heroStats').replaceChildren(...view.headline.map(h => {
      const d = document.createElement('div'); d.className = 'hs';
      d.append(textEl('div', h.label, 'hs-label'), textEl('div', h.value, 'hs-big'), textEl('div', h.note, 'hs-note'));
      return d;
    }));

    $('profile').replaceChildren(...view.profile.map(([k, v]) => {
      const s = document.createElement('span'); s.className = 'chip';
      const b = document.createElement('b'); b.textContent = v;
      s.append(k + ': ', b);
      return s;
    }));

    $('kpis').innerHTML = view.kpis.map(k =>
      `<div class="card kpi"><div class="kpi-top"><span class="kpi-icon ${k.c}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k.icon]}</svg></span>` +
      `<span class="kpi-label">${esc(k.label)}</span></div><div class="kpi-value">${esc(k.value)}</div><div class="kpi-note">${esc(k.note)}</div></div>`).join('');

    $('story').innerHTML = view.story.map((st, i) =>
      `<div class="story-card ${st.c}"><button class="icon-btn card-save" type="button" data-i="${i}" aria-label="Save this card as an image" title="Save as image"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span class="kpi-icon ${st.c}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[st.icon]}</svg></span>` +
      `<div class="story-big">${esc(st.big)}</div><p class="story-text">${esc(st.text)}</p></div>`).join('');
    $('storySection').hidden = !view.story.length;

    for (const c of CHARTS) {
      const fc = $(c.id)?.closest('figure')?.querySelector('figcaption');
      const cap = fc?.querySelector('.muted');
      if (cap) cap.textContent = c.sub;
      if (fc) {
        let t = fc.querySelector('.takeaway');
        if (!t) { t = document.createElement('p'); t.className = 'takeaway'; fc.querySelector('h3').after(t); }
        t.textContent = view.takeaways[c.key] || '';
      }
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
    const ov = computeExportOverview();
    $('convoSummary').textContent = all.length
      ? `${n(all.length)} matches still in your export · ${n(withMsgs)} (${pct(withMsgs, all.length)}) with messages from you · ${n(msgs)} messages sent · longest: ${n(longest)} messages.` +
        (ov.removed > 0 ? ` Your activity log counts ${n(ov.total)} matches all-time; Tinder leaves out the ${n(ov.removed)} that were unmatched or whose accounts were deleted.` : '')
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

  // ---------- About this export (always the whole file, ignores the period filter) ----------
  let exportOv = null;
  function computeExportOverview() {
    const dates = Object.keys(data.days).sort();
    const sum = k => Object.values(data.days).reduce((s, d) => s + d[k], 0);
    const total = sum('matches');
    const inFile = data.conversations.length;
    const removed = Math.max(0, total - inFile);
    const withMsgs = data.conversations.filter(c => c.messages.length).length;
    const msgsInFile = data.conversations.reduce((s, c) => s + c.messages.length, 0);
    const first = dates[0], last = dates[dates.length - 1];
    const spanDays = first ? Math.round((new Date(last) - new Date(first)) / 86400000) + 1 : 0;
    const activeDays = Object.values(data.days).filter(v => v.opens || v.likes || v.passes).length;
    const u = data.user || {};
    const created = u.create_date && /^\d{4}-\d{2}-\d{2}/.test(String(u.create_date)) ? String(u.create_date).slice(0, 10) : null;
    const secs = data.sections || {};
    const findKey = re => Object.keys(secs).find(k => re.test(k));
    const photosKey = findKey(/^photos$/i);
    const photos = photosKey && Array.isArray(secs[photosKey]) ? secs[photosKey].length : null;
    const purchKey = findKey(/^purchases$/i);
    let purchases = null;
    if (purchKey && secs[purchKey] && typeof secs[purchKey] === 'object') {
      const pv = secs[purchKey];
      purchases = Array.isArray(pv) ? pv.length : Object.values(pv).reduce((s, v) => s + (Array.isArray(v) ? v.length : 0), 0);
    }
    const spanText = spanDays >= 730 ? `${(spanDays / 365.25).toFixed(1)} years` : spanDays >= 60 ? `${Math.round(spanDays / 30.44)} months` : `${spanDays} days`;
    const stats = [
      { label: 'Data covers', value: first ? `${fmtDate(first)} – ${fmtDate(last)}` : '–', note: first ? `${spanText} · ${n(activeDays)} active days` : '', small: true },
      created ? { label: 'Account created', value: fmtDate(created), note: 'from your profile' , small: true } : null,
      data.fileInfo ? { label: 'File', value: data.fileInfo.name, note: fmtBytes(data.fileInfo.size), small: true } : null,
      { label: 'Matches all-time', value: n(total), note: 'from your daily activity log' },
      { label: 'Still in your export', value: n(inFile), note: total ? `${pct(inFile, total)} of all-time matches` : 'match entries in the file' },
      { label: 'Unmatched or removed', value: n(removed), note: total ? `${pct(removed, total)} of all-time matches` : '' },
      { label: 'Conversations you started', value: n(withMsgs), note: inFile ? `${pct(withMsgs, inFile)} of matches still in the file` : '' },
      { label: 'Messages in the file', value: n(msgsInFile), note: `${n(sum('sent'))} sent in your activity log` },
      { label: 'Messages received', value: n(sum('received')), note: 'from your activity log' },
      photos != null ? { label: 'Photos', value: n(photos), note: 'listed in the file' } : null,
      purchases != null ? { label: 'Purchases', value: n(purchases), note: 'subscriptions and add-ons' } : null,
    ].filter(Boolean);
    const sectionNames = ['Usage', 'Messages', 'User', ...Object.keys(secs)];
    const note = total
      ? (removed > 0
        ? `Your activity log recorded ${n(total)} matches, but only ${n(inFile)} are still listed in the file. Tinder removes a match from the export when either of you unmatches or an account is deleted, so the Overview count is higher.`
        : `All ${n(total)} matches from your activity log are still listed in the file.`)
      : 'Your activity log has no matches.';
    return { total, inFile, removed, stats, sectionNames, note,
      bar: total ? [{ label: 'Still in your export', value: Math.min(inFile, total), pct: Math.min(inFile, total) / total },
        { label: 'Unmatched or removed', value: removed, pct: removed / total }] : [] };
  }

  function renderExportOverview() {
    const ov = exportOv;
    $('ovGrid').replaceChildren(...ov.stats.map(s => {
      const d = document.createElement('div'); d.className = 'ov-stat' + (s.small ? ' small' : '');
      d.append(textEl('div', s.label, 'kpi-label'), textEl('div', s.value, 'ov-value'), textEl('div', s.note || '', 'kpi-note'));
      return d;
    }));
    $('ovMatchNote').textContent = ov.note;
    const colors = ['var(--series-1)', 'var(--series-2)'];
    const bar = $('ovBar');
    bar.replaceChildren(...ov.bar.filter(b => b.value > 0).map((b, i) => {
      const seg = document.createElement('div'); seg.className = 'ov-seg';
      seg.style.width = (b.pct * 100).toFixed(2) + '%';
      seg.style.background = colors[ov.bar.indexOf(b)];
      seg.title = `${b.label}: ${n(b.value)} (${pct(b.value, ov.total)})`;
      if (b.pct >= 0.12) seg.textContent = pct(b.value, ov.total);
      return seg;
    }));
    bar.hidden = !ov.bar.length;
    $('ovLegend').replaceChildren(...ov.bar.map((b, i) => {
      const span = document.createElement('span');
      const sw = document.createElement('i'); sw.style.background = colors[i];
      span.append(sw, `${b.label}: ${n(b.value)} (${pct(b.value, ov.total)})`);
      return span;
    }));
    $('ovSections').replaceChildren(...ov.sectionNames.map(s => textEl('span', pretty(s), 'kv-chip')));
  }

  function fmtBytes(b) {
    if (!b && b !== 0) return '';
    return b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
  }

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

  // ---------- Highlight the section currently on screen in the header nav ----------
  const navLinks = [...document.querySelectorAll('#topNav a')];
  let navTick = false;
  function updateActiveNav() {
    navTick = false;
    if ($('dashView').hidden) return;
    const line = window.innerHeight / 3;
    let cur = null;
    for (const a of navLinks) {
      const t = document.getElementById(a.getAttribute('href').slice(1));
      if (t && t.offsetParent && t.getBoundingClientRect().top < line) cur = a;
    }
    for (const a of navLinks) a.classList.toggle('active', a === cur);
    // keep the active link visible in the scrollable phone nav without moving the page
    const nav = $('topNav');
    if (cur && nav.scrollWidth > nav.clientWidth) {
      const l = cur.offsetLeft - nav.offsetLeft, r = l + cur.offsetWidth;
      if (l < nav.scrollLeft) nav.scrollLeft = l - 8;
      else if (r > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = r - nav.clientWidth + 8;
    }
  }
  window.addEventListener('scroll', () => { if (!navTick) { navTick = true; requestAnimationFrame(updateActiveNav); } }, { passive: true });

  // ---------- Theme: automatic -> light -> dark ----------
  const THEME_KEY = 'swipestats.theme';
  function applyTheme(t) {
    const root = document.documentElement;
    if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme;
    const label = t === 'light' ? 'light' : t === 'dark' ? 'dark' : 'automatic';
    const b = $('themeBtn'); b.dataset.mode = label; b.setAttribute('aria-label', 'Theme: ' + label); b.title = 'Theme: ' + label;
  }
  let theme = 'auto';
  try { theme = localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { /* storage unavailable */ }
  applyTheme(theme);
  $('themeBtn').addEventListener('click', () => {
    theme = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* storage unavailable */ }
    applyTheme(theme);
    if (data) render();
  });

  $('story').addEventListener('click', e => {
    const b = e.target.closest('.card-save');
    if (b && view) ExportReport.saveStoryCard(view.story[+b.dataset.i], +b.dataset.i);
  });

  window.SwipeApp = { getView: () => view, get CHARTS() { return CHARTS; }, ICONS };
})();
