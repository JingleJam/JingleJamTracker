
const HEADERS = {
  "content-type": "application/json;charset=UTF-8",
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Allow': 'GET, HEAD, OPTIONS'
};

export async function onRequest(context) {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return new Response(null,  {
        status: 204,
        headers: HEADERS
    });
  }

  let trends = await context.env.JINGLE_JAM_DATA.get('trends-previous');

  return new Response(trends, {
      headers: HEADERS
    });
}
   