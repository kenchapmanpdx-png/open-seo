// WO-B9-002 fixture: the only link to /js-only-target.html is added by script.
const link = document.createElement("a");
link.href = "/js-only-target.html";
link.textContent = "Volunteer guide";
document.getElementById("more").append(" ", link);
