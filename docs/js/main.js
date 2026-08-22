/* Luis Howin — shared page behaviour.
   Zero dependencies. Everything degrades gracefully:
   no JS => content simply renders without reveal animation. */
(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ── Mobile navigation disclosure ─────────────────────────── */
    var nav = document.querySelector('.nav');
    if (nav) {
        var toggle = nav.querySelector('.nav__toggle');
        if (toggle) {
            toggle.addEventListener('click', function () {
                var open = nav.classList.toggle('is-open');
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
            /* Close when a panel link is followed */
            nav.addEventListener('click', function (e) {
                if (e.target.closest('.nav__panel a')) {
                    nav.classList.remove('is-open');
                    toggle.setAttribute('aria-expanded', 'false');
                }
            });
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && nav.classList.contains('is-open')) {
                    nav.classList.remove('is-open');
                    toggle.setAttribute('aria-expanded', 'false');
                    toggle.focus();
                }
            });
        }

        /* Keep the sticky bar honest about its own state (no shadow,
           just a hairline that appears once content scrolls under). */
        var onScroll = function () {
            nav.classList.toggle('is-scrolled', window.scrollY > 8);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    /* ── Reveal on enter ──────────────────────────────────────── */
    var revealed = document.querySelectorAll('[data-reveal]');
    if (!revealed.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
        revealed.forEach(function (el) { el.classList.add('is-revealed'); });
        return;
    }

    /* Stagger siblings that share a [data-reveal-group] parent. */
    var groups = new Map();
    revealed.forEach(function (el) {
        var g = el.closest('[data-reveal-group]');
        if (!g) return;
        var n = groups.get(g) || 0;
        el.style.setProperty('--reveal-delay', Math.min(n * 70, 420) + 'ms');
        groups.set(g, n + 1);
    });

    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-revealed');
                io.unobserve(entry.target);
            }
        });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    Array.prototype.forEach.call(revealed, function (el) { io.observe(el); });

    /* ── Scroll-spy for the primary nav (index only) ──────────── */
    var sections = document.querySelectorAll('main section[id]');
    var links = document.querySelectorAll('.nav__links a[href^="#"]');
    if (!sections.length || !links.length) return;

    var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var id = '#' + entry.target.id;
            Array.prototype.forEach.call(links, function (link) {
                var active = link.getAttribute('href') === id;
                link.classList.toggle('is-active', active);
                if (active) { link.setAttribute('aria-current', 'true'); }
                else { link.removeAttribute('aria-current'); }
            });
        });
    }, { rootMargin: '-40% 0px -55% 0px' });

    Array.prototype.forEach.call(sections, function (s) { spy.observe(s); });
})();
