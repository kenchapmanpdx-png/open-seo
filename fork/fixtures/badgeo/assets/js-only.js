// WO-B2-027 fixture: injects the race calendar text after load (JS-only content).
const text =
  "The spring series runs every Saturday morning from the river park trailhead with a timed five kilometre loop, a ten kilometre course along the levee and a one mile family walk; entry costs twenty dollars for adults and ten dollars for students, packet pickup opens at seven, and the first wave starts at eight sharp. ";
const app = document.getElementById("app");
for (let i = 0; i < 6; i += 1) {
  const p = document.createElement("p");
  p.textContent = text;
  app.append(p);
}
