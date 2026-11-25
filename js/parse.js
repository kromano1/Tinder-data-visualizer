/* Reads a Tinder data export (data.json or the .zip) and normalizes it. */
(function (global) {
  'use strict';

  const MAX_BYTES = 500 * 1024 * 1024; // guard against huge or malicious files freezing the tab

  async function readFile(file) {
    if (file.size > MAX_BYTES) throw new Error('That file is too large (over 500 MB). Choose the Tinder export zip or data.json.');
    const name = (file.name || '').toLowerCase();
    let text;
    if (name.endsWith('.zip') || file.type === 'application/zip') {
      if (!global.JSZip) throw new Error('Could not load the zip reader. Unzip the file and drop data.json instead.');
      const zip = await global.JSZip.loadAsync(file);
      const entry = Object.values(zip.files).find(f => !f.dir && /(^|\/)data\.json$/i.test(f.name))
        || Object.values(zip.files).find(f => !f.dir && /\.json$/i.test(f.name));
      if (!entry) throw new Error('No data.json was found inside that zip file.');
      // _data.uncompressedSize is JSZip's record of the entry size; check it before inflating (zip-bomb guard)
      const size = entry._data && entry._data.uncompressedSize;
      if (size > MAX_BYTES) throw new Error('The data.json inside that zip is too large to open.');
      text = await entry.async('string');
    } else {
      text = await file.text();
    }
    let raw;
    try { raw = JSON.parse(text); } catch (e) {
      throw new Error('That file is not valid JSON. Make sure you picked data.json from your Tinder export.');
    }
    return normalize(raw);
  }

  // Map of our metric name -> possible keys in Usage
  const USAGE_KEYS = {
    opens: ['app_opens'],
    likes: ['swipes_likes', 'likes'],
    passes: ['swipes_passes', 'passes'],
    superlikes: ['superlikes', 'swipes_superlikes'],
    matches: ['matches'],
    sent: ['messages_sent'],
    received: ['messages_received'],
  };

  function pickSeries(usage, keys) {
    for (const k of keys) if (usage[k] && typeof usage[k] === 'object') return usage[k];
    return {};
  }

  // Usage dates are normally "YYYY-MM-DD" or ISO timestamps; accept a few other shapes rather than dropping them.
  function dayKey(k) {
    const s = String(k).trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return valid(m[1], m[2], m[3]);
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);           // MM/DD/YYYY
    if (m) return valid(m[3], m[1], m[2]);
    if (/^\d{10}$|^\d{13}$/.test(s)) {                                  // Unix seconds / milliseconds
      const d = new Date(s.length === 10 ? +s * 1000 : +s);
      return isNaN(d) ? null : d.toISOString().slice(0, 10);
    }
    const t = Date.parse(s);
    return isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
  }
  function valid(y, mo, d) {
    const k = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const t = new Date(k + 'T00:00:00Z');
    return !isNaN(t) && t.toISOString().slice(0, 10) === k ? k : null;
  }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Unrecognized file format.');
    const usage = raw.Usage || raw.usage;
    if (!usage) throw new Error('This file does not look like a Tinder data export (no "Usage" section found).');

    // Build a day-indexed map: { 'YYYY-MM-DD': { opens, likes, ... } }
    const days = {};
    const usedKeys = new Set();
    // What the file contains, field by field, so people can check nothing was dropped
    const usageReport = [];
    const report = (key, series) => {
      const r = { key, total: 0, days: 0, first: null, last: null, skipped: 0 };
      for (const [date, val] of Object.entries(series)) {
        const d = dayKey(date), n = Number(val);
        if (!d || !isFinite(n)) { r.skipped++; continue; }
        r.total += n; r.days++;
        if (!r.first || d < r.first) r.first = d;
        if (!r.last || d > r.last) r.last = d;
      }
      return r;
    };
    for (const [metric, keys] of Object.entries(USAGE_KEYS)) {
      for (const k of keys) if (usage[k] && typeof usage[k] === 'object') { usedKeys.add(k); usageReport.push(report(k, usage[k])); break; }
      const series = pickSeries(usage, keys);
      for (const [date, val] of Object.entries(series)) {
        const d = dayKey(date);
        const n = Number(val);
        if (!d || !isFinite(n)) continue;
        (days[d] ||= blankDay())[metric] += n;
      }
    }

    // Any other date-keyed series in Usage (newer exports add things like boosts or super likes received)
    const extras = {};
    for (const [k, series] of Object.entries(usage)) {
      if (usedKeys.has(k) || !series || typeof series !== 'object' || Array.isArray(series)) continue;
      const clean = {};
      for (const [date, val] of Object.entries(series)) {
        const d = dayKey(date);
        if (d && val !== '' && val !== null && isFinite(Number(val))) clean[d] = (clean[d] || 0) + Number(val);
      }
      if (Object.keys(clean).length) { extras[k] = clean; usageReport.push(report(k, series)); }
    }

    const conversations = (raw.Messages || raw.messages || []).map(m => {
      const msgs = (m.messages || []).map(x => ({
        text: decodeEntities(String(x.message ?? '')),
        date: parseDate(x.sent_date),
        // non-text messages: GIFs carry a fixed_height URL; type can be e.g. 'gif', 'sticker', 'song', 'tombstone'
        kind: x.fixed_height ? 'gif' : (x.type != null ? String(x.type).toLowerCase() : ''),
      })).filter(x => x.date);
      msgs.sort((a, b) => a.date - b.date);
      return { id: String(m.match_id || ''), messages: msgs };
    });

    const user = raw.User || raw.user || {};
    // Keep every other top-level section so the dashboard can show all of it
    const sections = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!/^(usage|messages|user)$/i.test(k)) sections[k] = v;
    }
    return { days, extras, conversations, user, sections, usageReport };
  }

  function blankDay() {
    return { opens: 0, likes: 0, passes: 0, superlikes: 0, matches: 0, sent: 0, received: 0 };
  }

  function parseDate(s) {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”' };
  function decodeEntities(s) {
    return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, code) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return isNaN(n) ? m : String.fromCodePoint(n);
      }
      return ENT[m.toLowerCase()] ?? m;
    });
  }

  global.TinderParse = { readFile, normalize, blankDay };
})(window);
