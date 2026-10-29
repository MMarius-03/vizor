import { options, sendEvent } from "../../../../../lib/rift-api";

export const dynamic = "force-dynamic";
export function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  return context.params.then(({ code }) => sendEvent(request, code));
}
export function OPTIONS(request: Request) { return options(request); }
