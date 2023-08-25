
const CACHE_NAME = 'tiltify-2023-cache';

const HEADERS = {
    "content-type": "application/json;charset=UTF-8",
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Allow': 'GET, HEAD, OPTIONS'
  };


async function handleRequest(request, env) {
	let response = '';

	let id = env.TILTIFY_CACHE.idFromName(CACHE_NAME);
	let obj = env.TILTIFY_CACHE.get(id);
	let resp = await obj.fetch(request.url);
	response = await resp.text();
  
	return new Response(response,  {
		headers: HEADERS
	  });
  }

export async function onRequest(context) {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return new Response(null,  {
        status: 204,
        headers: HEADERS
    });
  }

  return await handleRequest(context.request, context.env);
}

