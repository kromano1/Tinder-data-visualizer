/* Reads a Tinder data export (data.json or the .zip) and normalizes it. */
(function (global) {
  'use strict';

  async function readFile(file) {
    const name = (file.name || '').toLowerCase();
    let text;
    if (name.endsWith('.zip') || file.type === 'application/zip') {
      if (!global.JSZip) throw new Error('Could not load the zip reader. Unzip the file and drop data.json instead.');
      const zip = await global.JSZip.loadAsync(file);
      const entry = Object.values(zip.files).find(f => !f.dir && /(^|\/)data\.json$/i.test(f.name))
        || Object.values(zip.files).find(f => !f.dir && /\.json$/i.test(f.name));
      if (!entry) throw new Error('No data.json was found inside that zip file.');
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

  function normalize(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Unrecognized file format.');
    const usage = raw.Usage || raw.usage;
    if (!usage) throw new Error('This file does not look like a Tinder data export (no "Usage" section found).');

    // Build a day-indexed map: { 'YYYY-MM-DD': { opens, likes, ... } }
    const days = {};
    for (const [metric, keys] of Object.entries(USAGE_KEYS)) {
      const series = pickSeries(usage, keys);
      for (const [date, val] of Object.entries(series)) {
        const d = String(date).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
        const n = Number(val) || 0;
        (days[d] ||= blankDay())[metric] += n;
      }
    }

    const conversations = (raw.Messages || raw.messages || []).map(m => {
      const msgs = (m.messages || []).map(x => ({
        text: decodeEntities(String(x.message ?? '')),
        date: parseDate(x.sent_date),
      })).filter(x => x.date);
      msgs.sort((a, b) => a.date - b.date);
      return { id: m.match_id || '', messages: msgs };
    });

    const user = raw.User || raw.user || {};
    return { days, conversations, user };
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
