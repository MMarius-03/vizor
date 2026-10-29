import { respond, options } from "../../../lib/rift-api";

export const dynamic = "force-dynamic";
export function GET(request: Request) { return respond(request, { ok: true, service: "rift-sync" }); }
export function OPTIONS(request: Request) { return options(request); }
