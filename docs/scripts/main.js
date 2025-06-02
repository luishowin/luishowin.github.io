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

    // Clickable item for HABIT
    const clickableItem = document.querySelector('.clickable-item');
    if (clickableItem) {
      clickableItem.addEventListener('click', function () {
        window.location.href = 'habit';
      });
      clickableItem.style.cursor = 'pointer';
    }
  });