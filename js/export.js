/* Export the dashboard as a PDF report or a JPEG image.
   Everything is drawn onto <canvas> locally; nothing leaves the browser. */
(function (global) {
  'use strict';

  const $ = id => document.getElementById(id);
  const STORE_KEY = 'swipestats.export.v1';

  // ---------- Report look ----------
  const W = 1080;          // logical report width (px)
  const P = 44;            // outer padding
  const CW = W - P * 2;    // content width
  const GAP = 16;
  const C = {
    bg: '#f7f6f3', card: '#ffffff', border: '#e7e5df', text: '#0e0e10', text2: '#52514e', text3: '#7a7974',
    grid: '#eeece7', a: '#7b5cf0', b: '#e3497a', c: '#f0803c', pill: '#f3f2ee',
  };
  const TINT = { c1: C.a, c2: C.b, c3: C.c };
  const F = (weight, size) => `${weight} ${size}px ${Charts.FONT}`;

  // ---------- Options ----------
  function optionDefs() {
    const charts = SwipeApp.CHARTS;
    const byGroup = g => charts.filter(c => c.group === g).map(c => ({ key: 'chart:' + c.key, label: c.title }));
    return [
      { group: 'Summary', items: [
        { key: 'profile', label: 'Profile details', hint: 'Age, gender, city, age filter', def: false },
        { key: 'story', label: 'Your story', hint: 'Highlights in plain English' },
        { key: 'kpis', label: 'Overview stats', hint: 'Matches, swipes, rates and more' },
        { key: 'exportOv', label: 'About this export', hint: 'Date range, matches kept vs removed' },
      ] },
      { group: 'Swiping', items: byGroup('Swiping') },
      { group: 'Matching', items: byGroup('Matching') },
      { group: 'Messaging', items: byGroup('Messaging') },
      { group: 'Highlights', items: [
        { key: 'words', label: 'Favorite opening words', hint: 'Words from your first messages' },
        { key: 'topDays', label: 'Most active days' },
      ] },
      { group: 'App usage', items: byGroup('App usage') },
      { group: 'More activity', items: byGroup('More activity') },
    ].filter(g => g.items.length);
  }

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch (e) { return null; }
  }
  function save(state) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  function buildOptions() {
    const saved = loadSaved();
    const host = $('exportOptions');
    host.replaceChildren();
    for (const g of optionDefs()) {
      const wrap = document.createElement('div'); wrap.className = 'opt-group';
      const h = document.createElement('h4'); h.textContent = g.group;
      const list = document.createElement('div'); list.className = 'opt-list';
      for (const it of g.items) {
        const lab = document.createElement('label'); lab.className = 'opt';
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = it.key;
        cb.checked = saved && it.key in saved.sel ? saved.sel[it.key] : it.def !== false;
        const span = document.createElement('span'); span.textContent = it.label;
        if (it.hint) { const s = document.createElement('small'); s.textContent = it.hint; span.append(s); }
        lab.append(cb, span);
        list.append(lab);
      }
      wrap.append(h, list);
      host.append(wrap);
    }
    if (saved && saved.fmt) {
      const r = document.querySelector(`input[name="fmt"][value="${saved.fmt === 'jpeg' ? 'jpeg' : 'pdf'}"]`);
      if (r) r.checked = true;
    }
  }

  function readSelection() {
    const sel = {};
    for (const cb of $('exportOptions').querySelectorAll('input[type=checkbox]')) sel[cb.value] = cb.checked;
    const fmt = document.querySelector('input[name="fmt"]:checked').value;
    return { sel, fmt };
  }

  // ---------- Dialog ----------
  const dlg = $('exportDialog');
  function open() {
    const view = SwipeApp.getView();
    if (!view) return;
    buildOptions();
    $('exportPeriodNote').textContent = `Uses the period you selected (${view.periodLabel}). Your export is created on this device and saved to your downloads.`;
    $('exportStatus').textContent = '';
    $('exportGo').disabled = false;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function close() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }

  $('exportClose').addEventListener('click', close);
  $('exportCancel').addEventListener('click', close);
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); }); // click on backdrop
  $('optAll').addEventListener('click', () => $('exportOptions').querySelectorAll('input').forEach(i => { i.checked = true; }));
  $('optNone').addEventListener('click', () => $('exportOptions').querySelectorAll('input').forEach(i => { i.checked = false; }));
  $('exportGo').addEventListener('click', async () => {
    const { sel, fmt } = readSelection();
    save({ sel, fmt });
    const btn = $('exportGo'), status = $('exportStatus');
    btn.disabled = true;
    status.textContent = 'Building your ' + (fmt === 'pdf' ? 'PDF' : 'image') + '…';
    try {
      await new Promise(r => setTimeout(r, 30)); // let the status paint
      await run(fmt, sel);
      status.textContent = 'Done. Check your downloads.';
      setTimeout(close, 900);
    } catch (e) {
      console.error(e);
      status.textContent = 'Sorry, the export failed: ' + (e.message || e);
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- Drawing helpers ----------
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function card(ctx, x, y, w, h) {
    ctx.save();
    ctx.shadowColor = 'rgba(20,16,40,0.06)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
    rr(ctx, x, y, w, h, 16); ctx.fillStyle = C.card; ctx.fill();
    ctx.restore();
    rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 16); ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.stroke();
  }
  function text(ctx, s, x, y, font, color, align = 'left') {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, x, y);
  }
  function fit(ctx, s, font, maxW) {
    ctx.font = font;
    if (ctx.measureText(s).width <= maxW) return s;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  function gradient(ctx, x, y, w, h) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, C.a); g.addColorStop(0.58, C.b); g.addColorStop(1, C.c);
    return g;
  }
  function iconPaths(svgInner) {
    return [...svgInner.matchAll(/d="([^"]+)"/g)].map(m => new Path2D(m[1]));
  }

  // ---------- Report pieces ----------
  // Each item: { wide, height(w), draw(ctx, x, y, w, h) }

  function headerRow(view, withProfile) {
    const chips = withProfile ? view.profile : [];
    const chipFont = F(500, 13);
    // pre-measure chip rows
    const meas = document.createElement('canvas').getContext('2d');
    const chipLayout = []; let cx = 0, rows = chips.length ? 1 : 0; const maxW = CW - 72 - 260;
    for (const [k, v] of chips) {
      meas.font = chipFont;
      const w = meas.measureText(`${k}: ${v}`).width + 26;
      if (cx + w > maxW && cx > 0) { rows++; cx = 0; }
      chipLayout.push({ s: `${k}: ${v}`, x: cx, row: rows - 1, w });
      cx += w + 8;
    }
    const h = 200 + (rows ? rows * 38 + 6 : 0);
    return {
      h,
      draw(ctx) {
        const x = P, y = 0, w = CW;
        ctx.save();
        rr(ctx, x, y, w, h, 24); ctx.fillStyle = gradient(ctx, x, y, w, h); ctx.fill();
        ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.beginPath(); ctx.arc(x + w - 40, y - 20, 190, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + w - 300, y + h + 60, 120, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // brand mark
        rr(ctx, x + 36, y + 32, 28, 28, 8); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill();
        ctx.save(); ctx.translate(x + 38, y + 34); ctx.scale(1, 1);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.stroke(new Path2D('M5 17l4-5 3 3 6-7')); ctx.restore();
        text(ctx, 'SWIPE STATS', x + 74, y + 52, F(700, 13), 'rgba(255,255,255,0.9)');

        text(ctx, fit(ctx, view.title, F(800, 40), w - 360), x + 36, y + 118, F(800, 40), '#fff');
        text(ctx, fit(ctx, view.sub, F(500, 16), w - 360), x + 36, y + 150, F(500, 16), 'rgba(255,255,255,0.92)');

        text(ctx, view.hero.value, x + w - 36, y + 128, F(800, 64), '#fff', 'right');
        text(ctx, `${view.hero.label} · ${view.periodLabel.toLowerCase()}`, x + w - 36, y + 156, F(500, 15), 'rgba(255,255,255,0.9)', 'right');

        for (const c of chipLayout) {
          const cy = y + 184 + c.row * 38;
          rr(ctx, x + 36 + c.x, cy, c.w, 30, 15);
          ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
          text(ctx, c.s, x + 36 + c.x + 13, cy + 20, chipFont, '#fff');
        }
      },
    };
  }

  function sectionRow(label) {
    return {
      h: 30,
      draw(ctx) {
        ctx.font = F(700, 12.5);
        const s = label.toUpperCase().split('').join(' ');
        text(ctx, s, P + 2, 22, F(700, 12.5), C.text3);
        const tw = ctx.measureText(s).width;
        ctx.fillStyle = C.border; ctx.fillRect(P + tw + 16, 17, CW - tw - 16, 1);
      },
    };
  }

  function kpiRow(kpis) {
    const cols = 4, gap = 14, th = 120;
    const rows = Math.ceil(kpis.length / cols);
    const tw = (CW - gap * (cols - 1)) / cols;
    return {
      h: rows * th + (rows - 1) * gap,
      draw(ctx) {
        kpis.forEach((k, i) => {
          const x = P + (i % cols) * (tw + gap), y = Math.floor(i / cols) * (th + gap);
          card(ctx, x, y, tw, th);
          const tint = TINT[k.c] || C.a;
          rr(ctx, x + 18, y + 18, 30, 30, 9);
          ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = tint; ctx.fill(); ctx.restore();
          ctx.save(); ctx.translate(x + 24, y + 24); ctx.scale(0.75, 0.75);
          ctx.strokeStyle = tint; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          for (const p of iconPaths(SwipeApp.ICONS[k.icon] || '')) ctx.stroke(p);
          ctx.restore();
          text(ctx, fit(ctx, k.label, F(600, 13.5), tw - 76), x + 58, y + 38, F(600, 13.5), C.text2);
          text(ctx, k.value, x + 18, y + 86, F(780, 30), C.text);
          text(ctx, fit(ctx, k.note, F(400, 12), tw - 36), x + 18, y + 106, F(400, 12), C.text3);
        });
      },
    };
  }

  function exportOvRow(ov) {
    const cols = 4, gap = 10, sh = 78, pad = 22;
    const iw = CW - pad * 2;
    const tw = (iw - gap * (cols - 1)) / cols;
    const rows = Math.ceil(ov.stats.length / cols);
    const meas = document.createElement('canvas').getContext('2d');
    const noteLines = wrap(meas, ov.note, F(400, 13), iw);
    const gridH = rows * sh + (rows - 1) * gap;
    const h = pad + gridH + 26 + 22 + noteLines.length * 18 + 12 + 30 + 34 + pad - 6;
    const colors = Charts.LIGHT.series;
    return {
      h,
      draw(ctx) {
        const x = P, w = CW;
        card(ctx, x, 0, w, h);
        ov.stats.forEach((s, i) => {
          const sx = x + pad + (i % cols) * (tw + gap), sy = pad + Math.floor(i / cols) * (sh + gap);
          rr(ctx, sx, sy, tw, sh, 12); ctx.fillStyle = C.pill; ctx.fill();
          text(ctx, fit(ctx, s.label, F(600, 12.5), tw - 24), sx + 12, sy + 22, F(600, 12.5), C.text2);
          const vf = s.small ? F(650, 13.5) : F(760, 22);
          text(ctx, fit(ctx, s.value, vf, tw - 24), sx + 12, sy + (s.small ? 46 : 50), vf, C.text);
          text(ctx, fit(ctx, s.note || '', F(400, 11.5), tw - 24), sx + 12, sy + 68, F(400, 11.5), C.text3);
        });
        let y = pad + gridH + 30;
        text(ctx, 'Where your matches went', x + pad, y, F(650, 16), C.text);
        y += 22;
        noteLines.forEach((l, i) => text(ctx, l, x + pad, y + i * 18, F(400, 13), C.text2));
        y += noteLines.length * 18 + 4;
        // stacked bar
        let bx = x + pad;
        rr(ctx, bx, y, iw, 30, 10); ctx.fillStyle = C.pill; ctx.fill();
        ctx.save(); rr(ctx, bx, y, iw, 30, 10); ctx.clip();
        ov.bar.forEach((b, i) => {
          if (!b.value) return;
          const bw = iw * b.pct;
          ctx.fillStyle = colors[i]; ctx.fillRect(bx, y, bw, 30);
          if (i > 0) { ctx.fillStyle = C.card; ctx.fillRect(bx - 1, y, 2, 30); }
          if (b.pct >= 0.12) text(ctx, Charts.fmtPct(b.pct), bx + bw / 2, y + 20, F(700, 12.5), '#fff', 'center');
          bx += bw;
        });
        ctx.restore();
        y += 52;
        let lx = x + pad;
        ov.bar.forEach((b, i) => {
          rr(ctx, lx, y - 10, 10, 10, 3); ctx.fillStyle = colors[i]; ctx.fill();
          const t = `${b.label}: ${b.value.toLocaleString()} (${Charts.fmtPct(b.pct)})`;
          text(ctx, t, lx + 16, y, F(500, 13), C.text2);
          ctx.font = F(500, 13); lx += 16 + ctx.measureText(t).width + 22;
        });
      },
    };
  }

  function storyRow(story) {
    const cols = 3, gap = 14, pad = 20;
    const tw = (CW - gap * (cols - 1)) / cols;
    const meas = document.createElement('canvas').getContext('2d');
    const lines = story.map(st => wrap(meas, st.text, F(400, 14.5), tw - pad * 2));
    const rowsN = Math.ceil(story.length / cols);
    const rowH = r => 112 + Math.max(...lines.slice(r * cols, r * cols + cols).map(l => l.length)) * 20;
    const heights = Array.from({ length: rowsN }, (_, r) => rowH(r));
    return {
      h: heights.reduce((a, b) => a + b, 0) + gap * (rowsN - 1),
      draw(ctx) {
        let y = 0;
        for (let r = 0; r < rowsN; r++) {
          for (let c = 0; c < cols; c++) {
            const i = r * cols + c; if (i >= story.length) break;
            const st = story[i], x = P + c * (tw + gap), h = heights[r];
            card(ctx, x, y, tw, h);
            ctx.save(); rr(ctx, x, y, tw, h, 16); ctx.clip();
            ctx.fillStyle = gradient(ctx, x, y, tw, 4); ctx.fillRect(x, y, tw, 4); ctx.restore();
            const tint = TINT[st.c] || C.a;
            rr(ctx, x + pad, y + 20, 32, 32, 10);
            ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = tint; ctx.fill(); ctx.restore();
            ctx.save(); ctx.translate(x + pad + 6, y + 26); ctx.scale(0.83, 0.83);
            ctx.strokeStyle = tint; ctx.lineWidth = 2.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            for (const p of iconPaths(SwipeApp.ICONS[st.icon] || '')) ctx.stroke(p);
            ctx.restore();
            text(ctx, fit(ctx, st.big, F(800, 30), tw - pad * 2), x + pad, y + 92, F(800, 30), tint);
            lines[i].forEach((l, j) => text(ctx, l, x + pad, y + 118 + j * 20, F(400, 14.5), C.text2));
          }
          y += heights[r] + gap;
        }
      },
    };
  }

  function chartItem(meta, spec, scale, takeaway) {
    const multi = spec.datasets.length > 1;
    const meas = document.createElement('canvas').getContext('2d');
    const takeLines = w => takeaway ? wrap(meas, takeaway, F(520, 13.5), w - 66) : [];
    return {
      wide: !!meta.wide,
      height: w => (meta.wide ? 340 : 320) + (takeaway ? takeLines(w).length * 18 + 22 : 0),
      draw(ctx, x, y, w, h) {
        card(ctx, x, y, w, h);
        text(ctx, fit(ctx, meta.title, F(650, 17), w - 44), x + 22, y + 36, F(650, 17), C.text);
        let top = y + 50;
        if (takeaway) {
          const tl = takeLines(w);
          const bh = tl.length * 18 + 14;
          rr(ctx, x + 22, y + 48, w - 44, bh, 9); ctx.fillStyle = '#f2effd'; ctx.fill();
          ctx.fillStyle = C.a; ctx.fillRect(x + 22, y + 48, 3, bh);
          tl.forEach((l, i) => text(ctx, l, x + 34, y + 66 + i * 18, F(520, 13.5), C.text));
          top = y + 48 + bh + 6;
        }
        if (meta.sub) { text(ctx, fit(ctx, meta.sub, F(400, 12), w - 44), x + 22, top + 10, F(400, 12), C.text3); top += 22; }
        if (multi) {
          let lx = x + 22;
          spec.datasets.forEach((d, i) => {
            rr(ctx, lx, top + 2, 10, 10, 3); ctx.fillStyle = Charts.LIGHT.series[i]; ctx.fill();
            text(ctx, d.label, lx + 16, top + 12, F(500, 13), C.text2);
            ctx.font = F(500, 13); lx += 16 + ctx.measureText(d.label).width + 18;
          });
          top += 24;
        }
        const cw = w - 32, ch = y + h - 14 - top;
        const img = Charts.toCanvas(spec, cw, ch, scale);
        ctx.drawImage(img, x + 14, top, cw, ch);
      },
    };
  }

  function wordsItem(openers) {
    const pad = 22;
    function layout(w) {
      const meas = document.createElement('canvas').getContext('2d');
      const max = openers.words.length ? openers.words[0][1] : 1;
      const out = []; let cx = 0, cy = 0, rowH = 0;
      for (const [word, c, p] of openers.words) {
        const fs = Math.round(13 + 9 * c / max);
        const label = `${c} · ${p}`;
        meas.font = F(550, fs); const ww = meas.measureText(word).width;
        meas.font = F(500, 11); const cwid = meas.measureText(label).width;
        const pw = ww + cwid + 30, ph = fs + 16;
        if (cx + pw > w - pad * 2 && cx > 0) { cx = 0; cy += rowH + 8; rowH = 0; }
        out.push({ word, c: label, fs, x: cx, y: cy, w: pw, h: ph, ww });
        cx += pw + 8; rowH = Math.max(rowH, ph);
      }
      return { pills: out, height: out.length ? cy + rowH : 20 };
    }
    return {
      wide: false,
      height: w => 74 + layout(w).height + (openers.note ? 44 : 20),
      draw(ctx, x, y, w, h) {
        card(ctx, x, y, w, h);
        text(ctx, 'Your favorite opening words', x + pad, y + 36, F(650, 17), C.text);
        text(ctx, fit(ctx, 'Most common words in your first message to each match', F(400, 13), w - 44), x + pad, y + 58, F(400, 13), C.text2);
        const { pills, height } = layout(w);
        const top = y + 76;
        if (!pills.length) text(ctx, 'No messages in this period.', x + pad, top + 14, F(400, 13), C.text3);
        for (const p of pills) {
          const px = x + pad + p.x, py = top + p.y;
          rr(ctx, px, py, p.w, p.h, p.h / 2); ctx.fillStyle = C.pill; ctx.fill(); ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.stroke();
          text(ctx, p.word, px + 12, py + p.h / 2 + p.fs * 0.36, F(550, p.fs), C.text);
          text(ctx, String(p.c), px + 12 + p.ww + 5, py + p.h / 2 + p.fs * 0.36, F(500, 11), C.text3);
        }
        if (openers.note) {
          const lines = wrap(ctx, openers.note, F(400, 12.5), w - pad * 2);
          lines.forEach((l, i) => text(ctx, l, x + pad, top + height + 26 + i * 17, F(400, 12.5), C.text3));
        }
      },
    };
  }

  function topDaysItem(rows) {
    return {
      wide: false,
      height: () => 98 + Math.max(rows.length, 1) * 36,
      draw(ctx, x, y, w, h) {
        card(ctx, x, y, w, h);
        text(ctx, 'Your most active days', x + 22, y + 36, F(650, 17), C.text);
        text(ctx, 'Days with the most swipes', x + 22, y + 58, F(400, 13), C.text2);
        const top = y + 92;
        const c1 = x + 22, c3 = x + w - 22, c2 = c3 - 140, cs = c3 - 76;
        text(ctx, 'DATE', c1, top, F(600, 11.5), C.text3);
        text(ctx, 'SWIPES', c2, top, F(600, 11.5), C.text3, 'right');
        text(ctx, 'SHARE', cs, top, F(600, 11.5), C.text3, 'right');
        text(ctx, 'MATCHES', c3, top, F(600, 11.5), C.text3, 'right');
        if (!rows.length) text(ctx, 'No swipes in this period.', c1, top + 32, F(400, 13.5), C.text3);
        rows.forEach((r, i) => {
          const ry = top + 12 + i * 36;
          ctx.fillStyle = C.grid; ctx.fillRect(c1, ry, c3 - c1, 1);
          text(ctx, r[0], c1, ry + 24, F(500, 14), C.text);
          text(ctx, r[1], c2, ry + 24, F(600, 14), C.text, 'right');
          text(ctx, r[3], cs, ry + 24, F(500, 14), C.text2, 'right');
          text(ctx, r[2], c3, ry + 24, F(500, 14), C.text2, 'right');
        });
      },
    };
  }

  function footerRow() {
    const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    return {
      h: 26,
      draw(ctx) {
        text(ctx, `Made with Swipe Stats · tinder.romanoindustries.com · Generated ${date}`, W / 2, 18, F(500, 12.5), C.text3, 'center');
      },
    };
  }

  function wrap(ctx, s, font, maxW) {
    ctx.font = font;
    const words = s.split(' '); const lines = []; let line = '';
    for (const wd of words) {
      const t = line ? line + ' ' + wd : wd;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = wd; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  // Pack items into rows: wide items alone, half items in pairs
  function packRows(items) {
    const rows = [];
    const half = (CW - GAP) / 2;
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      if (a.wide) {
        const h = a.height(CW);
        rows.push({ h, draw: ctx => a.draw(ctx, P, 0, CW, h) });
      } else {
        const b = items[i + 1] && !items[i + 1].wide ? items[++i] : null;
        const h = Math.max(a.height(half), b ? b.height(half) : 0);
        rows.push({ h, draw: ctx => { a.draw(ctx, P, 0, half, h); if (b) b.draw(ctx, P + half + GAP, 0, half, h); } });
      }
    }
    return rows;
  }

  function buildRows(view, sel, scale) {
    const rows = [headerRow(view, sel.profile)];
    if (sel.story && view.story.length) rows.push(sectionRow('Your story'), storyRow(view.story));
    if (sel.kpis) rows.push(sectionRow('Overview'), kpiRow(view.kpis));
    if (sel.exportOv && view.exportOv) rows.push(sectionRow('About this export'), exportOvRow(view.exportOv));
    const groups = ['Swiping', 'Matching', 'Messaging', 'Highlights', 'App usage', 'More activity'];
    for (const g of groups) {
      const items = [];
      for (const m of SwipeApp.CHARTS.filter(c => c.group === g)) {
        if (sel['chart:' + m.key]) items.push(chartItem(m, view.charts[m.key], scale, view.takeaways[m.key]));
      }
      if (g === 'Highlights') {
        if (sel.words) items.push(wordsItem(view.openers));
        if (sel.topDays) items.push(topDaysItem(view.topDays));
      }
      if (items.length) rows.push(sectionRow(g), ...packRows(items));
    }
    rows.push(footerRow());
    return rows;
  }

  // ---------- Output ----------
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function fileBase(view) {
    const p = view.periodLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `swipe-stats-${p || 'export'}`;
  }

  async function run(fmt, sel) {
    const view = SwipeApp.getView();
    if (document.fonts && document.fonts.load) {
      await Promise.all(['400', '500', '600', '700', '800'].map(w => document.fonts.load(`${w} 16px Inter`))).catch(() => {});
    }
    if (fmt === 'jpeg') return runJpeg(view, sel);
    return runPdf(view, sel);
  }

  async function runJpeg(view, sel) {
    // Measure at scale 1 first (heights don't depend on scale)
    const rowsProbe = buildRows(view, sel, 1);
    const H = P + rowsProbe.reduce((s, r) => s + r.h, 0) + GAP * (rowsProbe.length - 1) + P;
    // Stay under mobile Safari's ~16.7M pixel canvas limit
    const scale = Math.max(1, Math.min(2, Math.sqrt(16e6 / (W * H))));
    const rows = buildRows(view, sel, scale);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    let y = P;
    for (const r of rows) {
      ctx.save(); ctx.setTransform(scale, 0, 0, scale, 0, y * scale);
      r.draw(ctx);
      ctx.restore();
      y += r.h + GAP;
    }
    const blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('Image too large for this browser')), 'image/jpeg', 0.92));
    download(blob, fileBase(view) + '.jpg');
  }

  async function runPdf(view, sel) {
    if (!global.jspdf) throw new Error('PDF library failed to load');
    const scale = 2;
    const rows = buildRows(view, sel, scale);
    const doc = new global.jspdf.jsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: true });
    doc.setProperties({ title: 'Swipe Stats', creator: 'Swipe Stats' });
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
    const k = pw / W;                       // px -> pt
    const margin = P * k;
    const paint = () => { doc.setFillColor(247, 246, 243); doc.rect(0, 0, pw, ph, 'F'); };
    paint();
    let y = margin;
    let page = 1;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const hpt = r.h * k;
      // keep a section title together with the row after it
      const next = rows[i + 1];
      const isSection = r.h === 30 && next;
      const need = isSection ? hpt + GAP * k + next.h * k : hpt;
      if (y + need > ph - margin && y > margin) { doc.addPage(); page++; paint(); y = margin; }
      const c = document.createElement('canvas');
      c.width = Math.round(W * scale); c.height = Math.round(r.h * scale);
      const ctx = c.getContext('2d');
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, c.width, c.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      r.draw(ctx);
      doc.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, y, pw, hpt, undefined, 'FAST');
      y += hpt + GAP * k;
      if (i % 3 === 2) await new Promise(res => setTimeout(res, 0)); // keep the UI responsive
    }
    // page numbers
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(122, 121, 116);
      doc.text(`${p} / ${total}`, pw - margin, ph - 14, { align: 'right' });
    }
    download(doc.output('blob'), fileBase(view) + '.pdf');
  }

  global.ExportReport = { open };
})(window);
