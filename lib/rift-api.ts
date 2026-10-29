import { and, count, eq, lt } from "drizzle-orm";
import { getDb } from "../db";
import { rooms } from "../db/schema";
import { applyEvent, initialState, type State } from "./rift-protocol";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TTL = 2 * 60 * 60 * 1000;
type Room = typeof rooms.$inferSelect;

function originHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const local = origin && /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);
  const permitted = origin === "https://mmarius-03.github.io" || origin === new URL(request.url).origin || local;
  return {
    "Access-Control-Allow-Origin": permitted ? origin! : "https://mmarius-03.github.io",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}

export function respond(request: Request, body: unknown, status = 200) {
  return Response.json(body, { status, headers: originHeaders(request) });
}

export function options(request: Request) {
  return new Response(null, { status: 204, headers: originHeaders(request) });
}

export function validCode(code: string) {
  return /^[A-HJ-NP-Z2-9]{6}$/.test(code);
}

function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

function live(room: Room) {
  return Date.now() - room.updatedAt < TTL;
}

function presence(room: Room) {
  const now = Date.now();
  return { console: now - room.consoleSeen < 8000, phone: now - room.phoneSeen < 8000 };
}

export async function createRoom(request: Request) {
  try {
    const db = getDb();
    const now = Date.now();
    await db.delete(rooms).where(lt(rooms.updatedAt, now - TTL));
    const [{ total }] = await db.select({ total: count() }).from(rooms);
    if (total >= 128) return respond(request, { error: "Prea multe sesiuni active. Încearcă mai târziu." }, 429);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode();
      const exists = await db.select({ code: rooms.code }).from(rooms).where(eq(rooms.code, code)).limit(1);
      if (exists.length) continue;
      const state = initialState();
      await db.insert(rooms).values({ code, state: JSON.stringify(state), revision: 0, createdAt: now, updatedAt: now, consoleSeen: now, phoneSeen: 0 });
      return respond(request, { code, state, presence: { console: true, phone: false } }, 201);
    }
    return respond(request, { error: "Nu s-a putut genera codul. Reîncearcă." }, 503);
  } catch {
    return respond(request, { error: "Backendul nu este disponibil momentan." }, 503);
  }
}

export async function getRoom(request: Request, code: string) {
  if (!validCode(code)) return respond(request, { error: "Cod invalid." }, 400);
  try {
    const db = getDb();
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
    if (!room || !live(room)) return respond(request, { error: "Camera nu mai există. Creează una nouă pe laptop." }, 404);
    const role = new URL(request.url).searchParams.get("role");
    const now = Date.now();
    if (role === "console") {
      await db.update(rooms).set({ consoleSeen: now, updatedAt: now }).where(eq(rooms.code, code));
      room.consoleSeen = now;
    } else if (role === "phone") {
      await db.update(rooms).set({ phoneSeen: now, updatedAt: now }).where(eq(rooms.code, code));
      room.phoneSeen = now;
    }
    return respond(request, { code, state: JSON.parse(room.state) as State, presence: presence(room) });
  } catch {
    return respond(request, { error: "Backendul nu este disponibil momentan." }, 503);
  }
}

export async function sendEvent(request: Request, code: string) {
  if (!validCode(code)) return respond(request, { error: "Cod invalid." }, 400);
  let event: unknown;
  try {
    const text = await request.text();
    if (text.length > 4096) return respond(request, { error: "Cerere prea mare." }, 413);
    event = JSON.parse(text);
  } catch { return respond(request, { error: "Cerere invalidă." }, 400); }

  try {
    const db = getDb();
    for (let attempt = 0; attempt < 4; attempt++) {
      const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
      if (!room || !live(room)) return respond(request, { error: "Camera nu mai există. Creează una nouă pe laptop." }, 404);
      const state = JSON.parse(room.state) as State;
      const result = applyEvent(state, event);
      if (!result.accepted) return respond(request, { error: result.reason, state }, 409);
      const updated = await db.update(rooms)
        .set({ state: JSON.stringify(result.state), revision: result.state.revision, updatedAt: Date.now() })
        .where(and(eq(rooms.code, code), eq(rooms.revision, room.revision)))
        .returning({ revision: rooms.revision });
      if (updated.length) return respond(request, { state: result.state });
    }
    return respond(request, { error: "Sesiune ocupată. Reîncearcă gestul." }, 409);
  } catch {
    return respond(request, { error: "Backendul nu este disponibil momentan." }, 503);
  }
}
