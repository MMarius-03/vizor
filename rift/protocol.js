export const FREQUENCIES = [0.22, 0.52, 0.82];
export const TOLERANCE = 0.085;

export function initialState() {
  return {
    phase: 'idle',
    frequency: FREQUENCIES[0],
    nodes: [false, false, false],
    pulse: 0,
    revision: 0,
    lastAction: 'init',
  };
}

export function applyEvent(current, event) {
  const fail = (reason) => ({ accepted: false, reason, state: current });
  const next = { ...current, nodes: [...current.nodes] };
  const type = event?.type;

  if (type === 'reset') return { accepted: true, state: { ...initialState(), revision: current.revision + 1, lastAction: 'reset' } };

  if (type === 'arm') {
    if (current.phase !== 'idle' && current.phase !== 'sealed') return fail('Portalul este deja activ.');
    return { accepted: true, state: { ...initialState(), phase: 'armed', revision: current.revision + 1, lastAction: 'arm' } };
  }

  if (type === 'frequency') {
    const value = Number(event.value);
    if (!Number.isFinite(value) || value < 0 || value > 1) return fail('Frecvență invalidă.');
    if (current.phase === 'idle' || current.phase === 'sealed') return fail('Deschide mai întâi ruptura.');
    next.frequency = value;
  } else if (type === 'place') {
    if (current.phase !== 'armed') return fail('Ruptura nu este pregătită pentru plasare.');
    next.phase = 'placed';
  } else if (type === 'node') {
    const index = Number(event.index);
    if (current.phase !== 'placed') return fail('Plasează mai întâi portalul.');
    if (!Number.isInteger(index) || index < 0 || index >= FREQUENCIES.length) return fail('Nod invalid.');
    if (current.nodes[index]) return fail('Nodul este deja stabilizat.');
    if (Math.abs(current.frequency - FREQUENCIES[index]) > TOLERANCE) {
      return fail(`Ajustează frecvența la ${Math.round(FREQUENCIES[index] * 100)}%.`);
    }
    next.nodes[index] = true;
    if (next.nodes.every(Boolean)) next.phase = 'stable';
    next.lastAction = `node:${index}`;
  } else if (type === 'pulse') {
    if (current.phase === 'idle' || current.phase === 'sealed') return fail('Ruptura este închisă.');
    next.pulse = current.pulse + 1;
  } else if (type === 'seal') {
    if (current.phase !== 'stable') return fail('Stabilizează toate cele trei noduri.');
    next.phase = 'sealed';
  } else {
    return fail('Acțiune necunoscută.');
  }

  next.revision = current.revision + 1;
  if (!next.lastAction || next.lastAction === current.lastAction) next.lastAction = type;
  return { accepted: true, state: next };
}
