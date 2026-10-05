import { Context } from "../types/env";
import { notFound } from "./handler";

// Any /api path that isn't an endpoint returns a JSON 404, instead of falling through to the website
export async function onRequest(context: Context): Promise<Response> {
  return await notFound(context);
}
