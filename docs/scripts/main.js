window.addEventListener("DOMContentLoaded", () => {
  // Navbar toggle
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
  }

  // Reveal on scroll
  function revealOnScroll() {
    const reveals = document.querySelectorAll('.reveal');
    reveals.forEach(el => {
      const windowHeight = window.innerHeight;
      const elementTop = el.getBoundingClientRect().top;
      const revealPoint = 100;

      if (elementTop < windowHeight - revealPoint) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }
  window.addEventListener('scroll', revealOnScroll);


const carousel = document.querySelector('.carousel');
let scrollSpeed = 1; // pixels per frame
let isUserInteracting = false;

// Autoscroll loop
function autoScroll() {
  if (!isUserInteracting) {
    carousel.scrollLeft += scrollSpeed;

    // Loop to start if at the end
    if (carousel.scrollLeft + carousel.offsetWidth >= carousel.scrollWidth) {
      carousel.scrollLeft = 0;
    }
  }
  requestAnimationFrame(autoScroll);
}
autoScroll();

// Drag overrides auto scroll
let isDragging = false;
let startX;
let scrollLeft;

carousel.addEventListener('mousedown', (e) => {
  isDragging = true;
  isUserInteracting = true;
  startX = e.pageX - carousel.offsetLeft;
  scrollLeft = carousel.scrollLeft;
  carousel.classList.add('dragging');
});
carousel.addEventListener('mouseleave', () => {
  isDragging = false;
  isUserInteracting = false;
  carousel.classList.remove('dragging');
});
carousel.addEventListener('mouseup', () => {
  isDragging = false;
  isUserInteracting = false;
  carousel.classList.remove('dragging');
});
carousel.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const x = e.pageX - carousel.offsetLeft;
  const walk = (x - startX) * 2; // Adjust scroll speed
  carousel.scrollLeft = scrollLeft - walk;
});

// Touch support
carousel.addEventListener('touchstart', (e) => {
  isDragging = true;
  isUserInteracting = true;
  startX = e.touches[0].pageX - carousel.offsetLeft;
  scrollLeft = carousel.scrollLeft;
});
carousel.addEventListener('touchend', () => {
  isDragging = false;
  isUserInteracting = false;
});
carousel.addEventListener('touchmove', (e) => {
  if (!isDragging) return;
  const x = e.touches[0].pageX - carousel.offsetLeft;
  const walk = (x - startX) * 2;
  carousel.scrollLeft = scrollLeft - walk;
});

  //Carousel drag/touch support
  if (carousel) {
    let isDragging = false;
    let startX;
    let scrollLeft;

    carousel.addEventListener('mousedown', (e) => {
      isDragging = true;
      carousel.classList.add('dragging');
      startX = e.pageX - carousel.offsetLeft;
      scrollLeft = carousel.scrollLeft;
    });

    carousel.addEventListener('mouseleave', () => {
      isDragging = false;
      carousel.classList.remove('dragging');
    });

    carousel.addEventListener('mouseup', () => {
      isDragging = false;
      carousel.classList.remove('dragging');
    });

    carousel.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const x = e.pageX - carousel.offsetLeft;
      const walk = (x - startX) * 2;
      carousel.scrollLeft = scrollLeft - walk;
    });

    carousel.addEventListener('touchmove', (e) => {
       if (isDragging) e.preventDefault(); // Stops the whole page from scrolling
    }, { passive: false });


    // Touch support
    carousel.addEventListener('touchstart', (e) => {
      isDragging = true;
      startX = e.touches[0].pageX - carousel.offsetLeft;
      scrollLeft = carousel.scrollLeft;
    });

    carousel.addEventListener('touchend', () => {
      isDragging = false;
    });

    carousel.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const x = e.touches[0].pageX - carousel.offsetLeft;
      const walk = (x - startX) * 2;
      carousel.scrollLeft = scrollLeft - walk;
    });
  }

  //Lazy loading images
  const lazyImages = document.querySelectorAll('img.lazyload');

  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazyload');
          observer.unobserve(img);
        }
      });
    });

    lazyImages.forEach(img => {
      imageObserver.observe(img);
    });
  } else {

    // Fallback: load all immediately
    lazyImages.forEach(img => {
      img.src = img.dataset.src;
      img.classList.remove('lazyload');
    });
  }
});
