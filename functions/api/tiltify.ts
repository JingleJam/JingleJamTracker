import { Context } from "../types/env";
import { CORS_HEADERS } from "./handler";

// The summary moved to /api/summary. A 308 redirect keeps the method and body, so the admin POST still works.
export async function onRequest(context: Context): Promise<Response> {
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }

  const url = new URL(context.request.url);
  url.pathname = '/api/summary';

  return new Response(null, {
    status: 308,
    headers: { ...CORS_HEADERS, 'Location': url.toString() }
  });
}
