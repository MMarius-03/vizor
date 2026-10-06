const moneyFormatter = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wholeFormatter = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

export const marja = (product) => ((product.pret - product.cost) / product.pret) * 100;
export const valoareStoc = (product) => product.cost * product.stoc;
export const statusForMargin = (margin) => (margin >= 25 ? "ok" : margin >= 10 ? "warn" : "bad");
export const formatLei = (amount) => `${moneyFormatter.format(amount)} lei`;
export const formatPercent = (amount) => `${amount.toLocaleString("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
export const formatWhole = (amount) => wholeFormatter.format(amount);

