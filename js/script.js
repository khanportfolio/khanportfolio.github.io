'use strict';

function getEffectiveTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/* ==========================================================================
   Theme toggle (persisted in localStorage)
   ========================================================================== */
(function themeToggle() {
  const root = document.documentElement;
  const btn = document.getElementById('theme-toggle');
  const stored = localStorage.getItem('ak-theme');

  if (stored) root.setAttribute('data-theme', stored);

  btn.addEventListener('click', () => {
    const next = getEffectiveTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('ak-theme', next);
  });
})();

/* ==========================================================================
   Hero avatar video — theme-matched cross-fade, ambient float + parallax,
   reduced-motion / save-data / error fallback handling
   ========================================================================== */
(function heroAvatarVideo() {
  const dayVideo = document.getElementById('hero-video-day');
  const nightVideo = document.getElementById('hero-video-night');
  const dayFrame = document.getElementById('hero-frame-day');
  const nightFrame = document.getElementById('hero-frame-night');
  const parallaxEl = document.getElementById('hero-video-parallax');
  const avatarFrame = document.getElementById('avatar-frame');
  if (!dayVideo || !nightVideo || !dayFrame || !nightFrame || !parallaxEl || !avatarFrame) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const conn = navigator.connection || navigator.webkitConnection || navigator.mozConnection;
  const isSaveData = !!(conn && (conn.saveData || ['slow-2g', '2g'].includes(conn.effectiveType)));
  const frameOf = { day: dayFrame, night: nightFrame };
  const videoOf = { day: dayVideo, night: nightVideo };

  // iOS ignores the muted attribute in some cases -- set the property too.
  dayVideo.muted = true;
  nightVideo.muted = true;

  let failed = { day: false, night: false };
  let autoplayBlocked = { day: false, night: false };

  function showFallback() {
    parallaxEl.style.display = 'none';
    avatarFrame.hidden = false;
  }
  function checkFallback() {
    const isDark = getEffectiveTheme() === 'dark';
    const activeFailed = isDark ? failed.night : failed.day;
    if (activeFailed || (failed.day && failed.night)) showFallback();
  }
  dayVideo.addEventListener('error', () => { failed.day = true; checkFallback(); });
  nightVideo.addEventListener('error', () => { failed.night = true; checkFallback(); });
  // defensive backstop: a video that neither errors nor ever becomes ready
  // (e.g. a bad/missing file the browser can't even start probing) would
  // otherwise leave an empty box -- catch that via readyState after a beat.
  setTimeout(() => {
    if (dayVideo.readyState === 0) { failed.day = true; }
    if (nightVideo.readyState === 0) { failed.night = true; }
    checkFallback();
  }, 4000);

  function isActiveKey(key) {
    const isDark = getEffectiveTheme() === 'dark';
    return isDark ? key === 'night' : key === 'day';
  }

  // silent fallback to the matching static first-frame still -- never the
  // old headshot -- when autoplay is rejected (iOS low-power/Data Saver) or
  // save-data mode skips video entirely. Never leaves a native play button.
  function showFrameFallback(key) {
    autoplayBlocked[key] = true;
    videoOf[key].classList.remove('is-ready');
    if (isActiveKey(key)) frameOf[key].classList.add('is-shown');
  }

  function tryPlay(video, key) {
    if (isSaveData) { showFrameFallback(key); return; }
    video.muted = true;
    const p = video.play();
    if (p && p.catch) p.catch(() => { showFrameFallback(key); });
  }

  // fade a video in (and hide its placeholder still) once it has an actual
  // decoded frame -- guards against the loadeddata listener attaching after
  // the event already fired. Playback is only attempted once we know the
  // video is ready, never immediately after load() -- calling play() in the
  // same tick as load() races the browser's own buffering on mobile and can
  // leave the video permanently stuck on its rejected-play fallback frame.
  function wireReady(video, key) {
    function onReady() {
      video.classList.add('is-ready');
      if (!autoplayBlocked[key] && isActiveKey(key)) {
        frameOf[key].classList.remove('is-shown');
        tryPlay(video, key);
      }
    }
    if (video.readyState >= 2) onReady();
    else video.addEventListener('loadeddata', onReady, { once: true });
  }

  function applyTheme() {
    if (failed.day && failed.night) return;
    const isDark = getEffectiveTheme() === 'dark';
    const activeKey = isDark ? 'night' : 'day';
    const inactiveKey = isDark ? 'day' : 'night';
    const active = videoOf[activeKey];
    const inactive = videoOf[inactiveKey];

    active.classList.add('is-active');
    inactive.classList.remove('is-active');
    frameOf[inactiveKey].classList.remove('is-shown');

    // only the active theme's video downloads up front (Bug 3) -- the
    // inactive one stays preload="none" until its theme is actually chosen.
    // Playback is deferred to wireReady's onReady so load() and play() never
    // race each other.
    if (active.preload !== 'auto') {
      active.preload = 'auto';
      active.load();
      wireReady(active, activeKey);
    } else if (active.classList.contains('is-ready') && !autoplayBlocked[activeKey]) {
      frameOf[activeKey].classList.remove('is-shown');
      tryPlay(active, activeKey);
    } else if (autoplayBlocked[activeKey]) {
      frameOf[activeKey].classList.add('is-shown');
    }

    inactive.pause();
  }

  applyTheme();
  if (reducedMotion) {
    dayVideo.pause();
    nightVideo.pause();
  }
  if (isSaveData) {
    // stop whatever native autoplay may have already kicked off, and stop further buffering
    dayVideo.pause(); nightVideo.pause();
    dayVideo.removeAttribute('autoplay'); nightVideo.removeAttribute('autoplay');
    showFrameFallback(getEffectiveTheme() === 'dark' ? 'night' : 'day');
  }

  // react to theme changes (toggle click updates the attribute; also cover system-preference changes)
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    if (!localStorage.getItem('ak-theme')) applyTheme();
  });

  // subtle parallax on desktop pointer devices only
  if (!reducedMotion && matchMedia('(pointer: fine)').matches) {
    let raf = null;
    let targetX = 0, targetY = 0, curX = 0, curY = 0;
    const MAX_SHIFT = 10;

    function loop() {
      curX += (targetX - curX) * 0.08;
      curY += (targetY - curY) * 0.08;
      parallaxEl.style.transform = `translate(${curX.toFixed(2)}px, ${curY.toFixed(2)}px)`;
      raf = Math.abs(targetX - curX) > 0.05 || Math.abs(targetY - curY) > 0.05 ? requestAnimationFrame(loop) : null;
    }

    window.addEventListener('mousemove', (e) => {
      const nx = (e.clientX / window.innerWidth) - 0.5;
      const ny = (e.clientY / window.innerHeight) - 0.5;
      targetX = -nx * MAX_SHIFT * 2;
      targetY = -ny * MAX_SHIFT * 2;
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
  }
})();

/* ==========================================================================
   Language switch (EN / DE) — toggles paired [data-lang] blocks
   ========================================================================== */
(function languageSwitch() {
  const langButtons = document.querySelectorAll('.lang-btn');
  if (!langButtons.length) return;

  function revealVisible(lang) {
    document.querySelectorAll(`[data-lang="${lang}"]`).forEach(root => {
      if (root.classList.contains('reveal')) root.classList.add('in-view');
      root.querySelectorAll('.reveal').forEach(el => el.classList.add('in-view'));
      root.querySelectorAll('.lang-bar span[data-width]').forEach(bar => {
        bar.style.width = bar.dataset.width;
      });
    });
  }

  function applyLang(lang, persist) {
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-lang="en"]').forEach(el => { el.hidden = lang !== 'en'; });
    document.querySelectorAll('[data-lang="de"]').forEach(el => { el.hidden = lang !== 'de'; });
    revealVisible(lang);

    document.querySelectorAll('[data-placeholder-en]').forEach(el => {
      el.setAttribute('placeholder', lang === 'de' ? el.dataset.placeholderDe : el.dataset.placeholderEn);
    });

    document.querySelectorAll('[data-aria-en]').forEach(el => {
      el.setAttribute('aria-label', lang === 'de' ? el.dataset.ariaDe : el.dataset.ariaEn);
    });

    langButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.langBtn === lang));

    const yearDe = document.getElementById('year-de');
    if (yearDe) yearDe.textContent = new Date().getFullYear();

    if (persist) localStorage.setItem('ak-lang', lang);
  }

  langButtons.forEach(btn => {
    btn.addEventListener('click', () => applyLang(btn.dataset.langBtn, true));
  });

  applyLang(localStorage.getItem('ak-lang') || 'de', false);
})();

/* ==========================================================================
   Header scroll state + mobile nav
   ========================================================================== */
(function headerNav() {
  const header = document.getElementById('site-header');
  const navToggle = document.getElementById('nav-toggle');
  const navMobile = document.getElementById('nav-mobile');

  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  navToggle.addEventListener('click', () => {
    const open = navMobile.classList.toggle('open');
    navToggle.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  });

  navMobile.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navMobile.classList.remove('open');
      navToggle.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
})();

/* ==========================================================================
   CV dropdown (Download CV: English / German)
   ========================================================================== */
(function cvDropdown() {
  const dropdowns = Array.from(document.querySelectorAll('.cv-dropdown'));
  if (!dropdowns.length) return;

  function closeAll() {
    dropdowns.forEach(d => {
      d.classList.remove('open');
      d.querySelector('.cv-dropdown-toggle')?.setAttribute('aria-expanded', 'false');
    });
  }

  dropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector('.cv-dropdown-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !dropdown.classList.contains('open');
      closeAll();
      if (willOpen) {
        dropdown.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
    dropdown.querySelectorAll('.cv-dropdown-item').forEach(item => {
      item.addEventListener('click', closeAll);
    });
  });

  document.addEventListener('click', closeAll);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
})();

/* ==========================================================================
   Active nav link on scroll
   ========================================================================== */
(function activeSection() {
  const sections = document.querySelectorAll('main section[id]');
  const links = document.querySelectorAll('.nav-link');

  const setActive = (id) => {
    links.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
    });
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) setActive(entry.target.id);
    });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

  sections.forEach(section => observer.observe(section));
})();

/* ==========================================================================
   Reveal-on-scroll animations
   ========================================================================== */
(function revealOnScroll() {
  const items = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  items.forEach(item => observer.observe(item));
})();

/* ==========================================================================
   Hero typing effect
   ========================================================================== */
function startTyping(elId, words) {
  const el = document.getElementById(elId);
  if (!el) return;

  let wordIndex = 0;
  let charIndex = 0;
  let deleting = false;

  function tick() {
    const current = words[wordIndex];

    if (!deleting) {
      charIndex++;
      el.textContent = current.slice(0, charIndex);
      if (charIndex === current.length) {
        deleting = true;
        setTimeout(tick, 1600);
        return;
      }
    } else {
      charIndex--;
      el.textContent = current.slice(0, charIndex);
      if (charIndex === 0) {
        deleting = false;
        wordIndex = (wordIndex + 1) % words.length;
      }
    }

    setTimeout(tick, deleting ? 35 : 65);
  }

  tick();
}

(function typedText() {
  startTyping('typed', [
    'production software.',
    'AI automation that saves hours.',
    'web & app development.',
    'AI-powered tools.',
    'CRMs that close deals.',
    'businesses, end-to-end.'
  ]);

  startTyping('typed-de', [
    'produktionsreife Software.',
    'KI-Automatisierung, die Zeit spart.',
    'Web- & App-Entwicklung.',
    'KI-gestützte Tools.',
    'CRMs, die Deals abschließen.',
    'Unternehmen, von A bis Z.'
  ]);
})();

/* ==========================================================================
   Animated stat counters
   ========================================================================== */
(function statCounters() {
  const stats = document.querySelectorAll('.stat-num');
  if (!stats.length) return;

  const animate = (el) => {
    const target = parseInt(el.dataset.count, 10) || 0;
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const duration = 1400;
    const start = performance.now();
    const locale = document.documentElement.lang === 'de' ? 'de-DE' : 'en-US';

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * eased);
      el.textContent = prefix + value.toLocaleString(locale) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animate(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  stats.forEach(stat => observer.observe(stat));
})();

/* ==========================================================================
   Language proficiency bars
   ========================================================================== */
(function langBars() {
  const wraps = document.querySelectorAll('.languages');
  if (!wraps.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.lang-bar span').forEach(bar => {
          bar.style.width = bar.dataset.width || '0%';
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });

  wraps.forEach(wrap => observer.observe(wrap));
})();

/* ==========================================================================
   Project screenshot fallback placeholders
   ========================================================================== */
(function imageFallback() {
  document.querySelectorAll('.media-img-wrap img').forEach(img => {
    img.addEventListener('error', () => {
      const wrap = img.closest('.media-img-wrap');
      if (!wrap || wrap.classList.contains('img-missing')) return;
      wrap.classList.add('img-missing');
      const hint = img.dataset.hint || img.getAttribute('src');
      const title = img.closest('.project-card')?.querySelector('h3')?.textContent || img.alt || 'Screenshot';
      wrap.innerHTML = `
        <div class="media-placeholder">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="9" r="1.5"/>
            <path d="m21 15-5-5L5 21"/>
          </svg>
          <span>${title} — screenshot coming soon</span>
          <code>${hint}</code>
        </div>`;
    }, { once: true });

    if (img.complete && img.naturalWidth === 0) {
      img.dispatchEvent(new Event('error'));
    }
  });
})();

/* ==========================================================================
   Lightbox for project screenshots
   ========================================================================== */
(function lightbox() {
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  const closeBtn = document.getElementById('lightbox-close');

  document.querySelectorAll('.media-frame').forEach(frame => {
    frame.addEventListener('click', (e) => {
      if (e.target.closest('.carousel-arrow, .carousel-dot')) return;
      const activeSlide = frame.querySelector('.carousel-slide.is-active');
      const img = activeSlide ? activeSlide.querySelector('img') : frame.querySelector('img');
      if (!img) return;
      lbImg.src = img.src;
      lbImg.alt = img.alt;
      lb.classList.add('open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    });
  });

  function close() {
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', close);
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();

/* ==========================================================================
   Media carousels (multi-image project cards — click arrows/dots or swipe)
   ========================================================================== */
(function mediaCarousels() {
  document.querySelectorAll('.media-carousel').forEach(carousel => {
    const track = carousel.querySelector('.carousel-track');
    const slides = Array.from(carousel.querySelectorAll('.carousel-slide'));
    const dots = Array.from(carousel.querySelectorAll('.carousel-dot'));
    const prevBtn = carousel.querySelector('.carousel-prev');
    const nextBtn = carousel.querySelector('.carousel-next');
    if (!track || slides.length < 2) return;

    let index = Math.max(0, slides.findIndex(s => s.classList.contains('is-active')));

    function goTo(i) {
      index = (i + slides.length) % slides.length;
      track.style.transform = `translateX(-${index * 100}%)`;
      slides.forEach((s, si) => s.classList.toggle('is-active', si === index));
      dots.forEach((d, di) => d.classList.toggle('active', di === index));
    }

    prevBtn?.addEventListener('click', (e) => { e.stopPropagation(); goTo(index - 1); });
    nextBtn?.addEventListener('click', (e) => { e.stopPropagation(); goTo(index + 1); });
    dots.forEach((dot, di) => dot.addEventListener('click', (e) => { e.stopPropagation(); goTo(di); }));

    let touchStartX = 0;
    carousel.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    carousel.addEventListener('touchend', (e) => {
      const delta = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(delta) > 40) goTo(delta > 0 ? index - 1 : index + 1);
    }, { passive: true });

    goTo(index);
  });
})();

/* ==========================================================================
   Project detail modal ("Read more" — full write-up per tool)
   ========================================================================== */
(function detailModal() {
  const modal = document.getElementById('detail-modal');
  const card = modal?.querySelector('.detail-card');
  const content = document.getElementById('detail-content');
  const closeBtn = document.getElementById('detail-close');
  if (!modal || !content) return;

  function open(key) {
    const template = document.getElementById(`detail-${key}`);
    if (!template) return;

    content.innerHTML = '';
    content.appendChild(template.content.cloneNode(true));

    content.querySelectorAll('img').forEach(img => {
      img.addEventListener('error', () => { img.closest('.detail-media')?.remove(); }, { once: true });
    });

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    card.scrollTop = 0;
  }

  function close() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.read-more-btn[data-detail]').forEach(btn => {
    btn.addEventListener('click', () => open(btn.dataset.detail));
  });

  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) close();
  });
})();

/* ==========================================================================
   Back to top button
   ========================================================================== */
(function backToTop() {
  const btn = document.getElementById('back-to-top');
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 500);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

/* ==========================================================================
   Contact form (client-side, opens a pre-filled mailto)
   ========================================================================== */
(function contactForm() {
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');
  if (!form) return;

  const messages = {
    en: {
      invalid: 'Please fill in every field with a valid email address.',
      sending: 'Sending...',
      sent: 'Thanks! Your message has been sent — I\'ll get back to you soon.',
      failed: 'Something went wrong sending that. Please email me directly at arhan.khan.careerdemands@gmail.com instead.'
    },
    de: {
      invalid: 'Bitte fülle alle Felder mit einer gültigen E-Mail-Adresse aus.',
      sending: 'Wird gesendet ...',
      sent: 'Danke! Deine Nachricht wurde gesendet — ich melde mich bald bei dir.',
      failed: 'Beim Senden ist etwas schiefgelaufen. Bitte schreib mir direkt an arhan.khan.careerdemands@gmail.com.'
    }
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const lang = document.documentElement.lang === 'de' ? 'de' : 'en';
    const t = messages[lang];

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const message = form.message.value.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name || !emailPattern.test(email) || !message) {
      status.textContent = t.invalid;
      status.classList.add('error');
      return;
    }

    if (form.botcheck && form.botcheck.checked) return;

    status.classList.remove('error');
    status.textContent = t.sending;

    const submitBtn = form.querySelector('button[type="submit"]:not([hidden])');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: form.access_key.value,
          subject: form.subject.value,
          name,
          email,
          message
        })
      });
      const data = await res.json();

      if (data.success) {
        status.textContent = t.sent;
        form.reset();
      } else {
        status.textContent = t.failed;
        status.classList.add('error');
      }
    } catch (err) {
      status.textContent = t.failed;
      status.classList.add('error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();

/* ==========================================================================
   Footer year
   ========================================================================== */
document.getElementById('year').textContent = new Date().getFullYear();
