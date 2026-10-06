import { formatPercent, marja, statusForMargin } from "./model.js";

const panelColors = { ok: "#0C9B72", warn: "#D98806", bad: "#DC3A3A", unknown: "#5A6472" };

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.closePath();
}

export function createPanelCanvas(product) {
  const canvas = document.createElement("canvas");
  canvas.id = `canvas-${product.cod}`;
  canvas.width = 768;
  canvas.height = 432;
  const context = canvas.getContext("2d");
  const margin = marja(product);
  const status = statusForMargin(margin);

  roundedRect(context, 4, 4, 760, 424, 28);
  context.fillStyle = panelColors[status];
  context.globalAlpha = 0.93;
  context.fill();
  context.globalAlpha = 1;
  context.strokeStyle = "rgba(255, 255, 255, 0.18)";
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = "#FFFFFF";
  context.font = "600 46px -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText(product.produs, 44, 92);
  context.fillStyle = "rgba(255,255,255,.68)";
  context.font = "400 30px -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText(product.um, 44, 136);
  context.fillStyle = "#FFFFFF";
  context.font = "700 86px -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText(product.pret.toLocaleString("ro-RO", { minimumFractionDigits: 2 }), 44, 258);
  context.font = "500 34px -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText("lei", 310, 258);
  context.fillStyle = "rgba(255,255,255,.65)";
  context.font = "600 22px -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText("MARJA", 548, 164);
  context.fillStyle = "#FFFFFF";
  context.font = "700 64px -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText(formatPercent(margin), 534, 234);
  context.fillStyle = "rgba(255,255,255,.76)";
  context.font = "400 28px -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText(`${product.stoc} buc in stoc`, 44, 370);
  context.textAlign = "right";
  context.fillText(`${product.rotatie} zile rotatie`, 724, 370);
  context.textAlign = "left";

  if (status === "bad") {
    context.fillStyle = "#FFFFFF";
    context.beginPath();
    context.moveTo(710, 44);
    context.lineTo(742, 98);
    context.lineTo(678, 98);
    context.closePath();
    context.fill();
    context.fillStyle = panelColors.bad;
    context.fillRect(708, 61, 4, 19);
    context.fillRect(708, 85, 4, 4);
  }

  return canvas;
}
