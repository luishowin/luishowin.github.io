window.addEventListener("DOMContentLoaded", () => {
  initNavbarToggle();
  initRevealOnScroll();
  initCarousel();
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

