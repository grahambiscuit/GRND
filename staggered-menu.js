/* ═══ STAGGERED MENU — vanilla JS + GSAP port ═════════════
   Adapted from the React Bits StaggeredMenu component so it
   runs in OXIS's plain HTML/JS app (no build step / no React).
   All menu items keep their original ids (tab-inventory, etc.)
   so the rest of app.js keeps working unchanged. */

(function () {
  let open = false;
  let busy = false;
  let openTl = null;
  let closeTween = null;

  let wrapper, panel, preLayers, toggleBtn, icon, textInner;

  function init() {
    wrapper    = document.getElementById('staggered-menu');
    panel      = document.getElementById('sm-panel');
    toggleBtn  = document.getElementById('sm-toggle-btn');
    icon       = document.getElementById('sm-icon');
    textInner  = document.getElementById('sm-text-inner');
    if (!wrapper || !panel || !toggleBtn) return;

    preLayers = Array.from(wrapper.querySelectorAll('.sm-prelayer'));

    const offscreen = wrapper.dataset.position === 'left' ? -100 : 100;
    gsap.set([panel, ...preLayers], { xPercent: offscreen });

    document.addEventListener('mousedown', (e) => {
      if (!open) return;
      if (panel.contains(e.target) || toggleBtn.contains(e.target)) return;
      window.closeStaggeredMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) window.closeStaggeredMenu();
    });
  }

  function buildOpenTimeline() {
    openTl && openTl.kill();
    if (closeTween) { closeTween.kill(); closeTween = null; }

    const itemEls   = Array.from(panel.querySelectorAll('.sm-panel-itemLabel'));
    const numberEls = Array.from(panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item'));

    gsap.set(itemEls, { yPercent: 140, rotate: 8 });
    gsap.set(numberEls, { '--sm-num-opacity': 0 });

    const offscreen = wrapper.dataset.position === 'left' ? -100 : 100;
    const tl = gsap.timeline({ paused: true });

    preLayers.forEach((el, i) => {
      tl.fromTo(el, { xPercent: offscreen }, { xPercent: 0, duration: 0.5, ease: 'power4.out' }, i * 0.07);
    });

    const lastTime = preLayers.length ? (preLayers.length - 1) * 0.07 : 0;
    const panelInsertTime = lastTime + (preLayers.length ? 0.08 : 0);
    const panelDuration = 0.6;

    tl.fromTo(panel, { xPercent: offscreen }, { xPercent: 0, duration: panelDuration, ease: 'power4.out' }, panelInsertTime);

    if (itemEls.length) {
      const itemsStart = panelInsertTime + panelDuration * 0.2;
      tl.to(itemEls, {
        yPercent: 0, rotate: 0, duration: 0.9, ease: 'power4.out',
        stagger: { each: 0.09, from: 'start' }
      }, itemsStart);

      if (numberEls.length) {
        tl.to(numberEls, {
          duration: 0.5, ease: 'power2.out', '--sm-num-opacity': 1,
          stagger: { each: 0.07, from: 'start' }
        }, itemsStart + 0.1);
      }
    }

    openTl = tl;
    return tl;
  }

  function playOpen() {
    if (busy) return;
    busy = true;
    const tl = buildOpenTimeline();
    tl.eventCallback('onComplete', () => { busy = false; });
    tl.play(0);
  }

  function playClose() {
    openTl && openTl.kill();
    openTl = null;

    const offscreen = wrapper.dataset.position === 'left' ? -100 : 100;
    const all = [...preLayers, panel];
    closeTween && closeTween.kill();
    closeTween = gsap.to(all, {
      xPercent: offscreen, duration: 0.3, ease: 'power3.in', overwrite: 'auto',
      onComplete: () => {
        const itemEls = Array.from(panel.querySelectorAll('.sm-panel-itemLabel'));
        gsap.set(itemEls, { yPercent: 140, rotate: 8 });
        const numberEls = Array.from(panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item'));
        gsap.set(numberEls, { '--sm-num-opacity': 0 });
        busy = false;
      }
    });
  }

  function animateIcon(opening) {
    gsap.killTweensOf(icon);
    gsap.to(icon, {
      rotate: opening ? 225 : 0,
      duration: opening ? 0.7 : 0.32,
      ease: opening ? 'power4.out' : 'power3.inOut',
      overwrite: 'auto'
    });
  }

  window.toggleStaggeredMenu = function () {
    open = !open;
    wrapper.toggleAttribute('data-open', open);
    panel.setAttribute('aria-hidden', String(!open));
    toggleBtn.setAttribute('aria-expanded', String(open));
    if (textInner) textInner.textContent = open ? 'Close' : 'Menu';
    animateIcon(open);
    if (open) playOpen(); else playClose();
  };

  window.closeStaggeredMenu = function () {
    if (!open) return;
    open = false;
    wrapper.removeAttribute('data-open');
    panel.setAttribute('aria-hidden', 'true');
    toggleBtn.setAttribute('aria-expanded', 'false');
    if (textInner) textInner.textContent = 'Menu';
    animateIcon(false);
    playClose();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
