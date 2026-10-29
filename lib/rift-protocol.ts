export const FREQUENCIES = [0.22, 0.52, 0.82];
const TOLERANCE = 0.085;

export type State = {
  phase: "idle" | "armed" | "placed" | "stable" | "sealed";
  frequency: number;
  nodes: boolean[];
  revision: number;
  lastAction: string;
};

export function initialState(): State {
  return { phase: "idle", frequency: FREQUENCIES[0], nodes: [false, false, false], revision: 0, lastAction: "init" };
}

export function applyEvent(current: State, event: unknown): { accepted: boolean; state: State; reason?: string } {
  const fail = (reason: string) => ({ accepted: false, reason, state: current });
  const value = event && typeof event === "object" ? event as Record<string, unknown> : {};
  const type = value.type;
  const next: State = { ...current, nodes: [...current.nodes] };

  if (type === "reset") return { accepted: true, state: { ...initialState(), revision: current.revision + 1, lastAction: "reset" } };
  if (type === "arm") {
    if (current.phase !== "idle" && current.phase !== "sealed") return fail("Portalul este deja activ.");
    return { accepted: true, state: { ...initialState(), phase: "armed", revision: current.revision + 1, lastAction: "arm" } };
  }
  if (type === "frequency") {
    if (typeof value.value !== "number" || !Number.isFinite(value.value) || value.value < 0 || value.value > 1) return fail("Frecvență invalidă.");
    if (current.phase === "idle" || current.phase === "sealed") return fail("Deschide mai întâi ruptura.");
    next.frequency = value.value;
  } else if (type === "place") {
    if (current.phase !== "armed") return fail("Ruptura nu este pregătită pentru plasare.");
    next.phase = "placed";
  } else if (type === "node") {
    const index = value.index;
    if (current.phase !== "placed") return fail("Plasează mai întâi portalul.");
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= FREQUENCIES.length) return fail("Nod invalid.");
    if (current.nodes[index]) return fail("Nodul este deja stabilizat.");
    if (Math.abs(current.frequency - FREQUENCIES[index]) > TOLERANCE) return fail(`Ajustează frecvența la ${Math.round(FREQUENCIES[index] * 100)}%.`);
    next.nodes[index] = true;
    if (next.nodes.every(Boolean)) next.phase = "stable";
    next.lastAction = `node:${index}`;
  } else if (type === "seal") {
    if (current.phase !== "stable") return fail("Stabilizează toate cele trei noduri.");
    next.phase = "sealed";
  } else return fail("Acțiune necunoscută.");

  next.revision = current.revision + 1;
  if (!next.lastAction || next.lastAction === current.lastAction) next.lastAction = String(type);
  return { accepted: true, state: next };
}
