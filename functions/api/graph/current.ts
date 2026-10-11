import { Context } from "../../types/env";
import { redirect } from "../handler";

// Moved to /api/v1/timeline, with the same response. Kept until the 2027 event.
export async function onRequest(context: Context): Promise<Response> {
  return redirect(context, '/api/v1/timeline');
}
