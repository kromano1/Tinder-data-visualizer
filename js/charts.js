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
      options: {
        responsive: !forExport,
        maintainAspectRatio: false,
        animation: forExport ? false : { duration: 350 },
        devicePixelRatio: forExport ? scale : undefined,
        interaction: { mode: 'index', intersect: false },
        events: forExport ? [] : undefined,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: !forExport,
            backgroundColor: t.surface, titleColor: t.text, bodyColor: t.text2, borderColor: t.grid, borderWidth: 1,
            padding: 10, boxPadding: 4, usePointStyle: true, cornerRadius: 10,
            titleFont: { weight: '600' },
            callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y == null ? '–' : fmt(c.parsed.y)}` },
          },
        },
        scales: {
          x: {
            stacked: !!o.stacked, grid: { display: false }, border: { color: t.grid },
            ticks: { color: t.text3, maxRotation: 0, autoSkip: true, autoSkipPadding: 14, font: { size: fs } },
            title: o.xTitle ? { display: true, text: o.xTitle, color: t.text3, font: { size: fs } } : undefined,
          },
          y: {
            stacked: !!o.stacked, beginAtZero: true, grid: { color: t.grid }, border: { display: false },
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

  global.Charts = { show, toCanvas, destroyAll, LIGHT, FONT };
})(window);
