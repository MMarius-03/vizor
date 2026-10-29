import { createRoom, options } from "../../../lib/rift-api";

export const dynamic = "force-dynamic";
export function POST(request: Request) { return createRoom(request); }
export function OPTIONS(request: Request) { return options(request); }
