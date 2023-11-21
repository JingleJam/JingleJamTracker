import { handleAPIRequest } from "../handler";

export async function onRequest(context) {
  return await handleAPIRequest(context, handleRequest);
}

async function handleRequest(request, env, cacheName) {
  let trends = await env.JINGLE_JAM_DATA.get('trends-previous');

  return trends
}