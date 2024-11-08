import { CacheResponse } from "../../types/CacheResponse";
import { Context, Env } from "../../types/env";
import { handleAPIRequest } from "../handler";

export async function onRequest(context: Context): Promise<Response> {
  return await handleAPIRequest(context, handleRequest);
}

async function handleRequest(request: Request, env: Env, cacheName: string): Promise<CacheResponse> {
  let data = (await env.JINGLE_JAM_DATA.get('trends-previous')) || "[]";

  return {
    data: data,
    status: 200
  };
}
