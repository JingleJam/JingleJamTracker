import { Context } from "../../types/env";
import { forwardToTiltifyData } from "../handler";

// The 2025 campaign list, kept in its 2025 shape until the 2027 event. The current version is /api/v1/campaigns.
export async function onRequest(context: Context): Promise<Response> {
  return await forwardToTiltifyData(context);
}
