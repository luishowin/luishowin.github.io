window.addEventListener("DOMContentLoaded", () => {
  initNavbarToggle();
  initRevealOnScroll();
  initCarousel();
  initLazyLoading();
});

// Toggle navbar on hamburger click
function initNavbarToggle() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  if (!hamburger || !navLinks) return;

  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('active');
  });
}


// Reveal elements on scroll
function initRevealOnScroll() {
  const reveals = document.querySelectorAll('.reveal');

  function revealOnScroll() {
    reveals.forEach(el => {
      const elementTop = el.getBoundingClientRect().top;
      const revealPoint = 100;
      const windowHeight = window.innerHeight;

      if (elementTop < windowHeight - revealPoint) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  window.addEventListener('scroll', revealOnScroll);
  revealOnScroll(); // Run once in case items are already visible
}

// Carousel autoscroll and drag
const carousel = document.querySelector('.carousel');
let isUserInteracting = false;
let isDragging = false;
let startX;
let scrollLeft;

// Autoscroll
function autoScroll() {
  if (!isUserInteracting && carousel) {
    carousel.scrollLeft += 1;
    if (carousel.scrollLeft + carousel.offsetWidth >= carousel.scrollWidth) {
      carousel.scrollLeft = 0;
    }
  }
  requestAnimationFrame(autoScroll);
}
autoScroll();

// Mouse + Touch Scroll
function startDrag(x) {
  isDragging = true;
  isUserInteracting = true;
  startX = x - carousel.offsetLeft;
  scrollLeft = carousel.scrollLeft;
  carousel.classList.add('dragging');
}

function drag(x) {
  if (!isDragging) return;
  const delta = (x - carousel.offsetLeft - startX) * 2;
  carousel.scrollLeft = scrollLeft - delta;
}

function stopDrag() {
  isDragging = false;
  isUserInteracting = false;
  carousel.classList.remove('dragging');
}

// Mouse Events
carousel.addEventListener('mousedown', (e) => startDrag(e.pageX));
carousel.addEventListener('mousemove', (e) => drag(e.pageX));
carousel.addEventListener('mouseup', stopDrag);
carousel.addEventListener('mouseleave', stopDrag);

// Touch Events
carousel.addEventListener('touchstart', (e) => startDrag(e.touches[0].pageX), { passive: true });
carousel.addEventListener('touchmove', (e) => {
  drag(e.touches[0].pageX);
}, { passive: false });
carousel.addEventListener('touchend', stopDrag);


// Lazy load images
function initLazyLoading() {
  const lazyImages = document.querySelectorAll('img.lazyload');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazyload');
          obs.unobserve(img);
        }
      });
    });

    lazyImages.forEach(img => observer.observe(img));
  } else {
    // Fallback: load all immediately
    lazyImages.forEach(img => {
      img.src = img.dataset.src;
      img.classList.remove('lazyload');
    });
  }
}