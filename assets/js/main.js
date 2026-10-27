(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Hero flash, driven by scroll (the page keeps moving). As the hero scrolls away, a
  // window-wide overlay dims the room, the EYESIGHT lens fires a white flash down at the
  // name (which throws a shadow), and the lights come back up on the work scrolling in.
  // Lens and name are measured every frame since both move with the page.
  const hero = $('.hero');
  const crop = $('.hero__arm-crop');
  const name = $('.hero h1');
  const canvas = $('.hero__light canvas');
  const ctx = canvas.getContext('2d');
  const LENS = { fx: 0.208, fy: 0.2333 };          // lens centre in the mirrored crop window (source 698,84 of 405-775 x 0-360)
  const RES = 0.5;                                  // soft light: half-resolution canvas
  const DIM = 0.55;                                 // how dark the room gets
  const HALF = 20 * Math.PI / 180;                  // flash spread (half-angle)
  const wide = matchMedia('(min-width: 861px)');
  let on = false;

  const layout = () => {
    on = wide.matches && !reduceMotion;
    hero.classList.toggle('is-lit', on);
    name.style.textShadow = '';
    if (!on) return;
    canvas.width = Math.round(innerWidth * RES);
    canvas.height = Math.round(innerHeight * RES);
  };

  const smooth = k => k * k * (3 - 2 * k);
  const span = (p, a, b) => smooth(Math.min(1, Math.max(0, (p - a) / (b - a))));
  const render = () => {
    if (!on) return;
    const W = innerWidth, H = innerHeight;
    // fires early, while the lens is still on screen; lights return as the work scrolls in
    const p = Math.min(1, Math.max(0, scrollY / (Math.max(420, hero.offsetHeight) * 0.9)));
    const flash = span(p, 0.1, 0.16) * (1 - span(p, 0.16, 0.5));       // sharp rise, slow decay
    const dim = DIM * span(p, 0, 0.1) * (1 - span(p, 0.45, 0.78)) * (1 - 0.3 * flash);

    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (dim < 0.002 && flash < 0.002) { name.style.textShadow = ''; return; }

    const cr = crop.getBoundingClientRect(), nr = name.getBoundingClientRect();
    const lx = cr.left + LENS.fx * cr.width, ly = cr.top + LENS.fy * cr.height;
    const nx = nr.left + nr.width * 0.5, ny = nr.top + nr.height * 0.5;
    const aim = Math.atan2(ny - ly, nx - lx);
    const reach = Math.hypot(nx - lx, ny - ly) * 1.7;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(14, 14, 16, ${dim})`;
    ctx.fillRect(0, 0, W, H);

    if (flash > 0.002) {
      // the flash carves light out of the dark: feathered spread, falling off with distance
      ctx.globalCompositeOperation = 'destination-out';
      const fall = ctx.createRadialGradient(lx, ly, 0, lx, ly, reach);
      fall.addColorStop(0, 'rgba(0,0,0,1)');
      fall.addColorStop(0.62, 'rgba(0,0,0,0.95)');
      fall.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fall;
      ctx.globalAlpha = 0.16 * flash;
      for (let i = 0; i < 28; i++) {
        const half = HALF * (0.45 + 0.04 * i);
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.arc(lx, ly, reach, aim - half, aim + half); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // a small white bloom at the lens
      ctx.globalCompositeOperation = 'source-over';
      const bloom = ctx.createRadialGradient(lx, ly, 0, lx, ly, 26);
      bloom.addColorStop(0, `rgba(255, 255, 255, ${0.95 * flash})`);
      bloom.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = bloom;
      ctx.beginPath(); ctx.arc(lx, ly, 26, 0, Math.PI * 2); ctx.fill();
    }

    // the name's shadow: one crisp shadow thrown away from the lens plus a soft penumbra;
    // it sharpens at the peak of the flash and softens as the flash decays
    const len = 20 * flash;
    const sx = Math.cos(aim) * len, sy = Math.sin(aim) * len;
    name.style.textShadow = flash < 0.01 ? '' :
      `${sx.toFixed(1)}px ${sy.toFixed(1)}px ${(1.5 + 6 * (1 - flash)).toFixed(1)}px rgba(14, 14, 16, ${(0.42 * flash).toFixed(3)}), ` +
      `${(sx * 1.25).toFixed(1)}px ${(sy * 1.25).toFixed(1)}px ${(12 + 8 * (1 - flash)).toFixed(1)}px rgba(14, 14, 16, ${(0.16 * flash).toFixed(3)})`;
  };
  let queued = false;
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; render(); }); } };
  layout(); render();
  addEventListener('resize', () => { layout(); render(); });
  addEventListener('scroll', queue, { passive: true });

  // Mobile menu
  const nav = $('.nav');
  const toggle = $('.nav__toggle');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
  });
  $$('.nav a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }));

  // Active section in the top bar
  const navLinks = new Map($$('.nav a').map(a => [a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const id = e.target.id;
      navLinks.forEach((a, key) => a.classList.toggle('is-active', key === id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main > section[id], main > article[id]').forEach(s => spy.observe(s));

  // Loop videos only while visible; respect reduced motion
  const vids = $$('video[data-autoplay]');
  if (reduceMotion) {
    vids.forEach(v => { v.controls = true; v.preload = 'metadata'; });
  } else {
    const vio = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const v = e.target;
        if (e.isIntersecting) { v.play().catch(() => { v.controls = true; }); }
        else v.pause();
      });
    }, { threshold: 0.25 });
    vids.forEach(v => vio.observe(v));
  }

  // Lightbox
  const lb = $('#lightbox');
  const lbImg = $('img', lb);
  const lbCap = $('.lightbox__cap', lb);
  $$('[data-lightbox]').forEach(el => el.addEventListener('click', () => {
    lbImg.src = el.dataset.lightbox;
    lbImg.alt = $('img', el)?.alt || '';
    lbCap.textContent = el.dataset.caption || '';
    lb.showModal();
  }));
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
  lb.addEventListener('close', () => { lbImg.removeAttribute('src'); });

  // Email, assembled client-side to keep it away from scrapers
  $$('.js-email').forEach(a => {
    const addr = `${a.dataset.u}@${a.dataset.d}`;
    a.href = `mailto:${addr}`;
    a.textContent = addr;
  });
})();
