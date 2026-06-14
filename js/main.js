/* =========================================================
   KREATIVE SOLUTION — main.js
   Handles: Navbar, scroll animations, counter, testimonials,
            portfolio filter, contact form, mobile nav
   ========================================================= */

'use strict';

/* ---- Utility: DOM helpers ---- */
const qs  = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* =========================================================
   1. NAVBAR — scroll state + active link spy
   ========================================================= */
const navbar     = qs('#navbar');
const navToggle  = qs('#nav-toggle');
const navMobile  = qs('#nav-mobile');
const mobileLinks = qsa('.mobile-link');

// Scroll state
window.addEventListener('scroll', () => {
  if (window.scrollY > 60) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
  updateActiveNavLink();
}, { passive: true });

// Mobile menu toggle
navToggle.addEventListener('click', () => {
  const isOpen = navMobile.classList.toggle('open');
  navToggle.classList.toggle('open', isOpen);
  navToggle.setAttribute('aria-expanded', String(isOpen));
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

// Close mobile nav on link click
mobileLinks.forEach(link => {
  link.addEventListener('click', () => {
    navMobile.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  });
});

// Active link scroll spy
const sections = qsa('section[id]');
const navLinks = qsa('.nav-links a[href^="#"]');

function updateActiveNavLink() {
  const scrollPos = window.scrollY + 100;
  sections.forEach(section => {
    const top    = section.offsetTop;
    const height = section.offsetHeight;
    const id     = section.getAttribute('id');
    const link   = qs(`.nav-links a[href="#${id}"]`);
    if (link) {
      if (scrollPos >= top && scrollPos < top + height) {
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    }
  });
}

/* =========================================================
   2. SCROLL REVEAL ANIMATIONS — IntersectionObserver
   ========================================================= */
function initReveal() {
  const revealEls = qsa('.reveal, .reveal-left, .reveal-right');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  revealEls.forEach(el => observer.observe(el));
}

/* =========================================================
   3. HERO COUNTERS — animated number count-up
   ========================================================= */
function animateCounter(el, target, duration = 2000, suffix = '+') {
  const start = performance.now();
  const update = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out quad
    const eased = 1 - (1 - progress) * (1 - progress);
    const current = Math.floor(eased * target);
    el.textContent = current + suffix;
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

function initCounters() {
  const statsData = [
    { id: 'stat-projects', target: 25 },
    { id: 'stat-years',    target: 10 },
    { id: 'stat-clients',  target: 15 },
  ];

  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        const data = statsData.find(d => d.id === id);
        if (data) animateCounter(entry.target, data.target);
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  statsData.forEach(({ id }) => {
    const el = qs(`#${id}`);
    if (el) statsObserver.observe(el);
  });
}

/* =========================================================
   4. PORTFOLIO FILTER
   ========================================================= */
function initPortfolioFilter() {
  const filterBtns  = qsa('.filter-btn');
  const portfolioItems = qsa('.portfolio-item');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;

      portfolioItems.forEach(item => {
        const category = item.dataset.category;
        if (filter === 'all' || category === filter) {
          item.style.display = '';
          item.style.opacity = '0';
          item.style.transform = 'scale(0.95)';
          // Animate in
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
              item.style.opacity = '1';
              item.style.transform = 'scale(1)';
            });
          });
        } else {
          item.style.transition = 'opacity 0.3s ease';
          item.style.opacity = '0';
          setTimeout(() => {
            item.style.display = 'none';
          }, 300);
        }
      });

      // Fix first-item span class when "all" is selected
      const firstItem = qs('#port-item-1');
      if (firstItem) {
        if (filter === 'all') {
          firstItem.style.gridColumn = 'span 2';
        } else {
          firstItem.style.gridColumn = '';
        }
      }
    });
  });
}

/* =========================================================
   5. TESTIMONIALS — carousel
   ========================================================= */
function initTestimonials() {
  const track  = qs('#testimonials-track');
  const dots   = qsa('.testi-dot');
  const prevBtn = qs('#testi-prev');
  const nextBtn = qs('#testi-next');
  const cards  = qsa('.testimonial-card');

  if (!track || !cards.length) return;

  let current = 0;
  let itemsPerView = getItemsPerView();
  const total = cards.length;
  let autoPlay;

  function getItemsPerView() {
    if (window.innerWidth < 768) return 1;
    if (window.innerWidth < 1024) return 2;
    return 3;
  }

  function getMaxIndex() {
    return Math.max(0, total - itemsPerView);
  }

  function goTo(index) {
    const maxIndex = getMaxIndex();
    current = Math.max(0, Math.min(index, maxIndex));

    const cardWidth = cards[0].offsetWidth + 28; // gap = 28px
    track.style.transform = `translateX(-${current * cardWidth}px)`;

    // Update dots (show only up to maxIndex+1 dots)
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === current);
    });
  }

  prevBtn.addEventListener('click', () => {
    resetAutoPlay();
    goTo(current - 1);
  });

  nextBtn.addEventListener('click', () => {
    resetAutoPlay();
    goTo(current === getMaxIndex() ? 0 : current + 1);
  });

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      resetAutoPlay();
      goTo(parseInt(dot.dataset.index));
    });
  });

  function startAutoPlay() {
    autoPlay = setInterval(() => {
      goTo(current === getMaxIndex() ? 0 : current + 1);
    }, 5000);
  }

  function resetAutoPlay() {
    clearInterval(autoPlay);
    startAutoPlay();
  }

  window.addEventListener('resize', () => {
    itemsPerView = getItemsPerView();
    goTo(0);
  });

  goTo(0);
  startAutoPlay();
}

/* =========================================================
   6. CONTACT FORM — validation + submission simulation
   ========================================================= */
function initContactForm() {
  const form        = qs('#contact-form');
  const formContent = qs('#contact-form-content');
  const formSuccess = qs('#form-success');
  const submitBtn   = qs('#form-submit-btn');

  if (!form) return;

  function showError(field, msg) {
    field.style.borderColor = '#ef4444';
    field.style.boxShadow = '0 0 0 4px rgba(239,68,68,0.1)';
    let errorEl = field.parentNode.querySelector('.form-error');
    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.className = 'form-error';
      errorEl.style.cssText = 'color:#ef4444;font-size:0.78rem;margin-top:4px;display:block;';
      field.parentNode.appendChild(errorEl);
    }
    errorEl.textContent = msg;
  }

  function clearError(field) {
    field.style.borderColor = '';
    field.style.boxShadow = '';
    const errorEl = field.parentNode.querySelector('.form-error');
    if (errorEl) errorEl.remove();
  }

  // Live validation
  ['#form-name','#form-phone','#form-service'].forEach(sel => {
    const el = qs(sel);
    if (el) el.addEventListener('input', () => clearError(el));
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;

    const name    = qs('#form-name');
    const phone   = qs('#form-phone');
    const service = qs('#form-service');

    if (!name.value.trim()) {
      showError(name, 'Please enter your name.');
      valid = false;
    } else clearError(name);

    if (!phone.value.trim() || !/^[\d\s\+\-\(\)]{7,}$/.test(phone.value.trim())) {
      showError(phone, 'Please enter a valid phone number.');
      valid = false;
    } else clearError(phone);

    if (!service.value) {
      showError(service, 'Please select a service.');
      valid = false;
    } else clearError(service);

    if (!valid) return;

    // Submit state
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="animation:spin 1s linear infinite">
        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
      </svg>
      Sending…
    `;

    // Simulate form submission (replace with Formspree / EmailJS / backend)
    setTimeout(() => {
      formContent.style.display = 'none';
      formSuccess.style.display = 'block';
    }, 1800);
  });
}

// Spin keyframe via JS
const style = document.createElement('style');
style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
document.head.appendChild(style);

/* =========================================================
   7. SMOOTH SCROLL — for all internal anchor links
   ========================================================= */
function initSmoothScroll() {
  qsa('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href === '#') return;
      const target = qs(href);
      if (target) {
        e.preventDefault();
        const offset = navbar ? navbar.offsetHeight : 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

/* =========================================================
   8. FAB WHATSAPP — hide/show based on scroll position
   ========================================================= */
function initFAB() {
  const fab = qs('#fab-whatsapp');
  if (!fab) return;

  let lastScroll = 0;
  fab.style.transition = 'opacity 0.3s, transform 0.3s';

  window.addEventListener('scroll', () => {
    const current = window.scrollY;
    if (current > 300) {
      fab.style.opacity = '1';
      fab.style.transform = 'scale(1)';
    } else {
      fab.style.opacity = '0';
      fab.style.transform = 'scale(0.8)';
    }
    lastScroll = current;
  }, { passive: true });

  // Initially hidden
  fab.style.opacity = '0';
  fab.style.transform = 'scale(0.8)';
}

/* =========================================================
   9. INIT — run everything on DOMContentLoaded
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  initCounters();
  initPortfolioFilter();
  initTestimonials();
  initContactForm();
  initSmoothScroll();
  initFAB();

  // Initial navbar scroll check (in case page loaded mid-scroll)
  if (window.scrollY > 60) navbar.classList.add('scrolled');
  updateActiveNavLink();
});
