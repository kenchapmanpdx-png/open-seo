// WO-B2-027 fixture: reveals the course notes only after the first scroll.
addEventListener(
  "scroll",
  () => {
    document.querySelector(".reveal").classList.add("shown");
  },
  { once: true },
);
