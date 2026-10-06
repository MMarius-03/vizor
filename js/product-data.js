export const SAMPLE_CODE = "5942326402258";
const API = "https://world.openfoodfacts.org/api/v3/product/";

function validGtin(code) {
  if (![8, 12, 13, 14].includes(code.length)) return false;
  const sum = [...code.slice(0, -1)].reverse().reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === Number(code.at(-1));
}

export function classifyScan(raw) {
  const value = raw.trim();
  if (/^\d+$/.test(value)) return validGtin(value) ? { kind: "product", code: value } : { kind: "invalid", value };
  try {
    const url = new URL(value);
    if (!(["http:", "https:"].includes(url.protocol))) return { kind: "text", value };
    const match = url.pathname.match(/(?:^|\/)01\/(\d{14})(?:\/|$)/);
    if (match && validGtin(match[1])) return { kind: "product", code: match[1].replace(/^0+(?=\d{13}$)/, ""), url: url.href };
    return { kind: "link", url: url.href, host: url.hostname };
  } catch {
    return { kind: "text", value };
  }
}

function quantityLitres(quantity) {
  const match = String(quantity || "").match(/(\d+(?:[.,]\d+)?)\s*(ml|cl|l)\b/i);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  return amount * ({ ml: .001, cl: .01, l: 1 })[match[2].toLowerCase()];
}

export async function lookupProduct(code, signal) {
  const fields = "code,product_name,brands,quantity,image_front_url,nutriments,nutrition_data_per,categories_tags";
  const response = await fetch(`${API}${encodeURIComponent(code)}.json?fields=${fields}`, { signal });
  if (!response.ok) throw new Error("Baza de produse nu răspunde acum. Încearcă din nou.");
  const data = await response.json();
  if (data.status !== "success" || !data.product) return null;
  const item = data.product;
  const sample = code === SAMPLE_CODE;
  const nutriments = item.nutriments || {};
  const water = sample || item.categories_tags?.includes("en:waters");
  const minerals = water && item.nutrition_data_per === "100ml" ? [
    ["Calciu", "calcium_100g"], ["Magneziu", "magnesium_100g"],
    ["Sodiu", "sodium_100g"], ["Bicarbonat", "bicarbonate_100g"],
  ].map(([label, key]) => ({ label, value: Number(nutriments[key]) * 10000 })).filter(({ value, label }) => Number.isFinite(value) && value > 0 && value < (label === "Bicarbonat" ? 2000 : 1000)) : [];
  return {
    code,
    name: sample ? "Apă minerală plată" : item.product_name || "Produs fără nume",
    brand: item.brands?.split(",")[0]?.trim() || "Brand neprecizat",
    quantity: item.quantity || "Cantitate neprecizată",
    litres: quantityLitres(item.quantity),
    image: item.image_front_url || null,
    minerals,
    isWater: water,
    isSample: sample,
    source: `${API}${encodeURIComponent(code)}.json`,
  };
}
