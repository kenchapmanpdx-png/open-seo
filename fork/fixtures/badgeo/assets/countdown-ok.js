// WO-B9-010 negative fixture: the HTML already holds the final value; JS only re-sets it.
for (const el of document.querySelectorAll(".seat-count")) {
  el.textContent = el.getAttribute("data-from");
}
