// WO-B9-010 fixture: Elementor-style counters ship 0 and count up to data-to-value.
for (const el of document.querySelectorAll(".counter-number")) {
  el.textContent = el.getAttribute("data-to-value");
}
