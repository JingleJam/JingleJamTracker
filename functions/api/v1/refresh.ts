import { Context } from "../../types/env";
import { ADMIN_ONLY_METHODS, forwardToTiltifyData } from "../handler";

// POST (admin only) to refresh all the data now, even when timed refreshing is off
export async function onRequest(context: Context): Promise<Response> {
  return await forwardToTiltifyData(context, ADMIN_ONLY_METHODS);
}
