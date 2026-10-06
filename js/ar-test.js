import { startScanner } from "./ar.js";

const button = document.querySelector("#start-ar-test");
const mount = document.querySelector("#ar-test-mount");
const status = document.querySelector("#ar-test-status");

button.addEventListener("click", async () => {
  button.disabled = true;
  button.textContent = "Pornesc camera...";
  try {
    await startScanner(mount);
    mount.classList.add("is-active");
    document.body.classList.add("is-scanning");
    status.textContent = "Caut markerul cu codul 0...";
  } catch (error) {
    button.disabled = false;
    button.textContent = "Încearcă din nou";
    status.textContent = error.message;
  }
});

