import { getRoom, options } from "../../../../lib/rift-api";

export const dynamic = "force-dynamic";
export function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  return context.params.then(({ code }) => getRoom(request, code));
}
export function OPTIONS(request: Request) { return options(request); }
