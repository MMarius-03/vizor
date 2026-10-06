import { startScanner } from "./ar.js";

const startButton = document.querySelector("#start-camera");
const startScreen = document.querySelector(".start-screen");
const scannerScreen = document.querySelector("#scanner-screen");

startButton.addEventListener("click", async () => {
  startButton.disabled = true;
  startButton.textContent = "Pornesc camera...";
  try {
    await startScanner(scannerScreen);
    const hud = document.createElement("div");
    hud.className = "scanner-hud";
    hud.innerHTML = '<span class="scanner-status">Caut un card...</span>';
    scannerScreen.append(hud);
    startScreen.classList.remove("is-active");
    scannerScreen.classList.add("is-active");
  } catch (error) {
    startButton.disabled = false;
    startButton.textContent = "Încearcă din nou";
    const existing = document.querySelector(".camera-error");
    if (existing) existing.remove();
    const message = document.createElement("p");
    message.className = "privacy camera-error";
    message.textContent = error.message;
    startButton.after(message);
  }
});

