/* The header gains a soft edge once content scrolls under it. Every page loads this. */
const topbar = document.querySelector('.topbar');
if (topbar) {
  let ticking = false;
  const update = () => { ticking = false; topbar.classList.toggle('scrolled', window.scrollY > 4); };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}
