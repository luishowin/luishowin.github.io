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
function initCarousel() {
  const carousel = document.querySelector('.carousel');
  if (!carousel) return;

  let isDragging = false;
  let startX = 0;
  let scrollLeft = 0;
  let isUserInteracting = false;
  const scrollSpeed = 1;

  // Autoscroll loop
  function autoScroll() {
    if (!isUserInteracting) {
      carousel.scrollLeft += scrollSpeed;
      if (Math.ceil(carousel.scrollLeft + carousel.offsetWidth) >= carousel.scrollWidth) {
        carousel.scrollLeft = 0;
      }
    }
    requestAnimationFrame(autoScroll);
  }
  autoScroll();

  // Drag support
  function startDrag(x) {
    isDragging = true;
    isUserInteracting = true;
    startX = x - carousel.offsetLeft;
    scrollLeft = carousel.scrollLeft;
    carousel.classList.add('dragging');
  }

  function moveDrag(x) {
    if (!isDragging) return;
    const walk = (x - startX) * 2;
    carousel.scrollLeft = scrollLeft - walk;
  }

  function endDrag() {
    isDragging = false;
    isUserInteracting = false;
    carousel.classList.remove('dragging');
  }

  // Mouse events
  carousel.addEventListener('mousedown', e => startDrag(e.pageX));
  carousel.addEventListener('mousemove', e => moveDrag(e.pageX));
  carousel.addEventListener('mouseup', endDrag);
  carousel.addEventListener('mouseleave', endDrag);

  // Touch events
  carousel.addEventListener('touchstart', e => startDrag(e.touches[0].pageX));
  carousel.addEventListener('touchmove', e => {
    if (isDragging) e.preventDefault(); // Prevent page scroll
    moveDrag(e.touches[0].pageX);
  }, { passive: false });
  carousel.addEventListener('touchend', endDrag);
}

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