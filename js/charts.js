/* Chart.js wrappers. A chart is described by a "spec" so the same chart can be
   drawn on screen (current theme) and into an export (always light theme). */
(function (global) {
  'use strict';
  const instances = {};
  const FONT = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  if (global.Chart) {
    Chart.defaults.font.family = FONT;
    Chart.defaults.font.size = 11;
  }

  // Fixed light palette used for exports (validated reference palette, light mode)
  const LIGHT = {
    text: '#0e0e10', text2: '#52514e', text3: '#7a7974', grid: '#eeece7', surface: '#ffffff',
    series: ['#2a78d6', '#eb6834', '#1baf7a'],
  };

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function currentTheme() {
    return {
      text: css('--text'), text2: css('--text-2'), text3: css('--text-3'), grid: css('--grid'), surface: css('--surface'),
      series: [css('--series-1'), css('--series-2'), css('--series-3')],
    };
  }

  function fmtPct(v) {
    const p = v * 100;
    return (p > 0 && p < 10 ? p.toFixed(1) : Math.round(p)) + '%';
  }

  // Draws a percentage label on every bar segment / point. Labels that would overlap
  // an already-placed label (or not fit inside a stacked segment) are skipped so text never collides.
  const pctLabels = {
    id: 'pctLabels',
    afterDatasetsDraw(chart, args, o) {
      if (!o || !o.pct) return;
      const ctx = chart.ctx, area = chart.chartArea, isBar = chart.config.type === 'bar';
      const placed = [];
      ctx.save();
      ctx.font = `600 ${o.size}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      chart.data.datasets.forEach((ds, di) => {
        const arr = o.pct[di];
        const meta = chart.getDatasetMeta(di);
        if (!arr || meta.hidden) return;
        meta.data.forEach((el, i) => {
          const v = arr[i];
          if (v == null || !isFinite(v) || v <= 0 || el.skip) return;
          const s = fmtPct(v);
          const tw = ctx.measureText(s).width + 4, th = o.size + 3;
          let x = el.x, y, inside = false;
          if (isBar && o.stacked) {
            // Stacked bars: label the first series' share above the whole stack
            // (the other series is the remainder, and the tooltip shows both).
            if (di !== 0) return;
            let top = el.y;
            chart.data.datasets.forEach((_, dj) => { const e = chart.getDatasetMeta(dj).data[i]; if (e && !chart.getDatasetMeta(dj).hidden) top = Math.min(top, e.y); });
            y = top - th / 2 - 1;
          } else if (isBar) {
            y = el.y - th / 2 - 1;
          } else {
            y = el.y - th / 2 - 5;
          }
          const r = { x1: x - tw / 2, x2: x + tw / 2, y1: y - th / 2, y2: y + th / 2 };
          if (r.x1 < area.left - 8 || r.x2 > area.right + 8 || r.y1 < 0) return;
          if (placed.some(p => r.x1 < p.x2 && r.x2 > p.x1 && r.y1 < p.y2 && r.y2 > p.y1)) return;
          placed.push(r);
          if (inside) {
            ctx.fillStyle = '#ffffff';
          } else {
            ctx.strokeStyle = o.halo; ctx.lineWidth = 3; ctx.strokeText(s, x, y);
            ctx.fillStyle = o.color;
          }
          ctx.fillText(s, x, y);
        });
      });
      ctx.restore();
    },
  };

  function fmtFor(percent) {
    return v => percent ? (v * 100).toFixed(v < 0.1 && v > 0 ? 1 : 0) + '%' : Number(v).toLocaleString();
  }

  function hexA(hex, a) {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  function buildConfig(spec, t, { forExport = false, scale = 1 } = {}) {
    const o = spec.opts || {};
    const fmt = fmtFor(o.percent);
    const fs = forExport ? 13 : 11;
    const isBar = spec.type === 'bar';
    const n = spec.labels.length;

    const datasets = spec.datasets.map((d, i) => {
      const c = t.series[i];
      if (isBar) {
        return {
          label: d.label, data: d.data,
          backgroundColor: c, hoverBackgroundColor: c,
          borderRadius: o.stacked ? 0 : { topLeft: 4, topRight: 4 },
          borderSkipped: 'bottom', borderColor: t.surface, borderWidth: o.stacked ? { top: 2 } : 0,
          maxBarThickness: 30, categoryPercentage: 0.8, barPercentage: 0.9,
        };
      }
      const single = spec.datasets.length === 1;
      return {
        label: d.label, data: d.data, borderColor: c, backgroundColor: single ? hexA(c, 0.10) : c,
        fill: single ? 'origin' : false,
        borderWidth: 2, tension: 0.3, spanGaps: true,
        pointRadius: n > 24 ? 0 : 3, pointHoverRadius: 5, pointBackgroundColor: c,
        pointHoverBorderColor: t.surface, pointHoverBorderWidth: 2,
      };
    });

    return {
      type: spec.type,
      data: { labels: spec.labels, datasets },
      plugins: [pctLabels],
      options: {
        layout: { padding: { top: spec.pct ? 6 : 0 } },
        responsive: !forExport,
        maintainAspectRatio: false,
        animation: forExport ? false : { duration: 350 },
        devicePixelRatio: forExport ? scale : undefined,
        interaction: { mode: 'index', intersect: false },
        events: forExport ? [] : undefined,
        plugins: {
          legend: { display: false },
          pctLabels: spec.pct ? { pct: spec.pct, stacked: !!o.stacked, size: forExport ? 11.5 : 10, color: t.text2, halo: t.surface } : false,
          tooltip: {
            enabled: !forExport,
            backgroundColor: t.surface, titleColor: t.text, bodyColor: t.text2, borderColor: t.grid, borderWidth: 1,
            padding: 10, boxPadding: 4, usePointStyle: true, cornerRadius: 10,
            titleFont: { weight: '600' },
            callbacks: {
              label: c => {
                if (c.parsed.y == null) return ` ${c.dataset.label}: –`;
                const share = !o.percent && spec.pct && spec.pct[c.datasetIndex] ? spec.pct[c.datasetIndex][c.dataIndex] : null;
                return ` ${c.dataset.label}: ${fmt(c.parsed.y)}` + (share != null && isFinite(share) ? ` (${fmtPct(share)}${spec.pctNote ? ' ' + spec.pctNote : ''})` : '');
              },
            },
          },
        },
        scales: {
          x: {
            stacked: !!o.stacked, grid: { display: false }, border: { color: t.grid },
            ticks: { color: t.text3, maxRotation: 0, autoSkip: true, autoSkipPadding: 14, font: { size: fs } },
            title: o.xTitle ? { display: true, text: o.xTitle, color: t.text3, font: { size: fs } } : undefined,
          },
          y: {
            stacked: !!o.stacked, beginAtZero: true, grace: spec.pct ? '12%' : 0, grid: { color: t.grid }, border: { display: false },
            ticks: { color: t.text3, maxTicksLimit: 5, font: { size: fs }, callback: fmt, padding: 6 },
          },
        },
      },
    };
  }

  // On-screen chart into <canvas id=...>, plus its legend element (#id-legend) if present
  function show(id, spec) {
    const el = document.getElementById(id);
    if (!el) return;
    if (instances[id]) instances[id].destroy();
    const t = currentTheme();
    instances[id] = new Chart(el, buildConfig(spec, t));
    const lg = document.getElementById(id + '-legend');
    if (lg) {
      lg.replaceChildren(...spec.datasets.map((d, i) => {
        const span = document.createElement('span');
        const sw = document.createElement('i');
        sw.style.background = t.series[i];
        span.append(sw, d.label);
        return span;
      }));
    }
  }

  // Draws a chart (light theme) into a new canvas of w x h CSS px at the given pixel scale.
  function toCanvas(spec, w, h, scale) {
    const host = document.getElementById('offscreen') || document.body;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    host.append(canvas);
    const chart = new Chart(canvas, buildConfig(spec, LIGHT, { forExport: true, scale }));
    // Copy pixels to a detached canvas so the chart can be destroyed immediately
    const out = document.createElement('canvas');
    out.width = canvas.width; out.height = canvas.height;
    out.getContext('2d').drawImage(canvas, 0, 0);
    chart.destroy();
    canvas.remove();
    return out;
  }

  function destroyAll() {
    for (const k of Object.keys(instances)) { instances[k].destroy(); delete instances[k]; }
  }

  global.Charts = { show, toCanvas, destroyAll, fmtPct, LIGHT, FONT };
})(window);
