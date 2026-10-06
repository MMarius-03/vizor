export const CATALOG = [
  { cod: 0, produs: "Salam Victoria", um: "350 g", pret: 24.9, cost: 18.2, stoc: 142, rotatie: 11 },
  { cod: 1, produs: "Cremwurst clasic", um: "500 g", pret: 19.5, cost: 18.15, stoc: 38, rotatie: 26 },
  { cod: 2, produs: "Parizer porc", um: "300 g", pret: 11.2, cost: 7.95, stoc: 410, rotatie: 4 },
  { cod: 3, produs: "Muschiulet afumat", um: "200 g", pret: 32, cost: 27.8, stoc: 64, rotatie: 18 },
  { cod: 4, produs: "Carnati taranesti", um: "1 kg", pret: 42.5, cost: 24.6, stoc: 87, rotatie: 7 },
];

export const productForCode = (code) => CATALOG.find((product) => product.cod === Number(code));

