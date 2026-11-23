/* Full-screen "Play your story" mode: one stat at a time, tap or use arrow keys. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const dlg = $('storyDialog');
  let idx = 0;
  let story = [];

  function draw() {
    const st = story[idx];
    $('smProgress').replaceChildren(...story.map((_, i) => { const b = document.createElement('i'); if (i <= idx) b.className = 'done'; return b; }));
    const card = $('smCard');
    card.className = 'sm-card ' + (st.c || '');
    card.replaceChildren();
    const icon = document.createElement('div'); icon.className = 'sm-icon';
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SwipeApp.ICONS[st.icon] || ''}</svg>`;
    const big = document.createElement('div'); big.className = 'sm-big'; big.textContent = st.big;
    const p = document.createElement('p'); p.className = 'sm-text'; p.textContent = st.text;
    card.append(icon, big, p);
    void card.offsetWidth; card.classList.add('enter');
    $('smCount').textContent = `${idx + 1} of ${story.length}`;
  }
  function go(d) {
    const n = idx + d;
    if (n < 0) return;
    if (n >= story.length) { close(); return; }
    idx = n; draw();
  }
  function open() {
    const view = SwipeApp.getView();
    if (!view || !view.story.length) return;
    story = view.story; idx = 0;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    draw();
  }
  function close() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }

  $('playStory').addEventListener('click', open);
  $('smClose').addEventListener('click', close);
  $('smPrev').addEventListener('click', () => go(-1));
  $('smNext').addEventListener('click', () => go(1));
  $('smSave').addEventListener('click', () => ExportReport.saveStoryCard(story[idx], idx, story.length));
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  });
  // swipe gestures on touch screens
  let x0 = null;
  $('smStage').addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  $('smStage').addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  });
})();
