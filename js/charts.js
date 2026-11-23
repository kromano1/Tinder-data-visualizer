/* Thin Chart.js wrappers that read colors from CSS custom properties. */
(function (global) {
  'use strict';
  const instances = {};

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function theme() {
    return {
      text: css('--text'), text2: css('--text-2'), text3: css('--text-3'), grid: css('--grid'),
      surface: css('--surface'), s1: css('--series-1'), s2: css('--series-2'), s3: css('--series-3'),
    };
  }

  function baseOptions(t, { percent = false, stacked = false, xTitle } = {}) {
    const fmt = v => percent ? (v * 100).toFixed(v < 0.1 && v > 0 ? 1 : 0) + '%' : Number(v).toLocaleString();
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: t.surface, titleColor: t.text, bodyColor: t.text2, borderColor: t.grid, borderWidth: 1,
          padding: 10, boxPadding: 4, usePointStyle: true,
          callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y == null ? '–' : fmt(c.parsed.y)}` },
        },
      },
      scales: {
        x: {
          stacked, grid: { display: false }, border: { color: t.grid },
          ticks: { color: t.text3, maxRotation: 0, autoSkip: true, autoSkipPadding: 12, font: { size: 11 } },
          title: xTitle ? { display: true, text: xTitle, color: t.text3, font: { size: 11 } } : undefined,
        },
        y: {
          stacked, beginAtZero: true, grid: { color: t.grid }, border: { display: false },
          ticks: { color: t.text3, maxTicksLimit: 5, font: { size: 11 }, callback: fmt },
        },
      },
    };
  }

  function draw(id, config) {
    if (instances[id]) instances[id].destroy();
    const el = document.getElementById(id);
    if (!el) return;
    instances[id] = new Chart(el, config);
  }

  function bar(id, labels, datasets, opts = {}) {
    const t = theme();
    const colors = [t.s1, t.s2, t.s3];
    draw(id, {
      type: 'bar',
      data: {
        labels,
        datasets: datasets.map((d, i) => ({
          label: d.label, data: d.data,
          backgroundColor: d.color || colors[i], hoverBackgroundColor: d.color || colors[i],
          borderRadius: opts.stacked ? 0 : { topLeft: 4, topRight: 4 },
          borderSkipped: 'bottom', borderColor: t.surface, borderWidth: opts.stacked ? { top: 2 } : 0,
          maxBarThickness: 28, categoryPercentage: 0.8, barPercentage: 0.9,
        })),
      },
      options: baseOptions(t, opts),
    });
  }

  function line(id, labels, datasets, opts = {}) {
    const t = theme();
    const colors = [t.s1, t.s2, t.s3];
    draw(id, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((d, i) => ({
          label: d.label, data: d.data, borderColor: colors[i], backgroundColor: colors[i],
          borderWidth: 2, tension: 0.25, spanGaps: true,
          pointRadius: labels.length > 24 ? 0 : 3, pointHoverRadius: 5,
          pointHoverBorderColor: t.surface, pointHoverBorderWidth: 2,
        })),
      },
      options: baseOptions(t, opts),
    });
  }

  function legend(key, items) {
    const el = document.querySelector(`[data-legend="${key}"]`);
    if (!el) return;
    const t = theme();
    const colors = [t.s1, t.s2, t.s3];
    el.replaceChildren(...items.map((label, i) => {
      const span = document.createElement('span');
      const swatch = document.createElement('i');
      swatch.style.background = colors[i];
      span.append(swatch, label);
      return span;
    }));
  }

  function destroyAll() {
    for (const k of Object.keys(instances)) { instances[k].destroy(); delete instances[k]; }
  }

  global.Charts = { bar, line, legend, destroyAll };
})(window);
