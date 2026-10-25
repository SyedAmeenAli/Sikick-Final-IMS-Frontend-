/** Counted lock so a drawer and a dialog can overlap without one releasing the other's lock. */
let count = 0;
export function lockScroll(): () => void {
  count += 1;
  document.documentElement.classList.add('locked');
  let done = false;
  return () => {
    if (done) return;
    done = true;
    count = Math.max(0, count - 1);
    if (count === 0) document.documentElement.classList.remove('locked');
  };
}
