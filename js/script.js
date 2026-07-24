'use strict';

/* ==========================================================================
   Theme toggle (persisted in localStorage)
   ========================================================================== */
(function themeToggle() {
  const root = document.documentElement;
  const btn = document.getElementById('theme-toggle');
  const stored = localStorage.getItem('ak-theme');

  if (stored) root.setAttribute('data-theme', stored);

  btn.addEventListener('click', () => {
    const current = root.getAttribute('data-theme') === 'light'
      ? 'light'
      : (root.getAttribute('data-theme') === 'dark' ? 'dark' : (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('ak-theme', next);
  });
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

  applyLang(localStorage.getItem('ak-lang') || 'en', false);
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
    'AI-powered tools.',
    'automation that saves hours.',
    'CRMs that close deals.',
    'businesses, end-to-end.'
  ]);

  startTyping('typed-de', [
    'produktionsreife Software.',
    'KI-gestützte Tools.',
    'Automatisierung, die Zeit spart.',
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
    frame.addEventListener('click', () => {
      const img = frame.querySelector('img');
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
      opening: 'Opening your email client...',
      sent: 'Thanks! Your email app should now be open with the message ready to send.'
    },
    de: {
      invalid: 'Bitte fülle alle Felder mit einer gültigen E-Mail-Adresse aus.',
      opening: 'E-Mail-Programm wird geöffnet ...',
      sent: 'Danke! Dein E-Mail-Programm sollte jetzt mit der fertigen Nachricht geöffnet sein.'
    }
  };

  form.addEventListener('submit', (e) => {
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

    status.classList.remove('error');
    status.textContent = t.opening;

    const subject = encodeURIComponent(`Portfolio contact from ${name}`);
    const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
    window.location.href = `mailto:arhan.khan.careerdemands@gmail.com?subject=${subject}&body=${body}`;

    setTimeout(() => {
      status.textContent = t.sent;
      form.reset();
    }, 600);
  });
})();

/* ==========================================================================
   Footer year
   ========================================================================== */
document.getElementById('year').textContent = new Date().getFullYear();
