/** Client-side CSV/JSON download of what is on screen. Nothing is uploaded. */
export function download(name: string, mime: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const esc = (v: string | number) => { const t = String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
export function downloadCsv(name: string, rows: Array<Array<string | number>>) { download(name, 'text/csv', rows.map((r) => r.map(esc).join(',')).join('\n')); }
