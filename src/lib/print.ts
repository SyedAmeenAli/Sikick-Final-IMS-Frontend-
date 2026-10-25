/** Opens the browser's own print dialog for one region of the page (CSS in components.css hides the rest while printing). */
export function printRegion(kind: 'receipt' | 'labels') {
  const done = () => { delete document.body.dataset.print; window.removeEventListener('afterprint', done); };
  document.body.dataset.print = kind;
  window.addEventListener('afterprint', done);
  try { window.print(); } finally { window.setTimeout(done, 1500); }
}
