import { handleAPIRequest } from "./handler";

export async function onRequest(context) {
  return await handleAPIRequest(context, handleRequest);
}

async function handleRequest(request, env, cacheName) {
  let response = '';

  let id = env.TILTIFY_CACHE.idFromName(cacheName);
  let obj = env.TILTIFY_CACHE.get(id);
  let resp = await obj.fetch(request.url);
  response = await resp.text();

  return response
}