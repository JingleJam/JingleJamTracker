import { Context } from "../../types/env";
import { ADMIN_METHODS, forwardToTiltifyData } from "../handler";

// GET for the event, POST (admin only) to replace the cached summary
export async function onRequest(context: Context): Promise<Response> {
  return await forwardToTiltifyData(context, ADMIN_METHODS);
}
