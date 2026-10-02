import { Context } from "../types/env";
import { forwardToTiltifyData } from "./handler";

export async function onRequest(context: Context): Promise<Response> {
  return await forwardToTiltifyData(context);
}
