export const $ = (id) => document.getElementById(id);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function toast(msg) {
  const bar = document.createElement("div");
  bar.className = "toast";
  bar.textContent = msg;
  document.body.appendChild(bar);
  setTimeout(() => (bar.style.opacity = 1), 10);
  setTimeout(() => (bar.style.opacity = 0), 3000);
  setTimeout(() => bar.remove(), 3500);
}
