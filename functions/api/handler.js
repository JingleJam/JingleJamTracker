const CACHE_NAME = 'tiltify-cache-2023';

const HEADERS = {
    "content-type": "application/json;charset=UTF-8",
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Allow': 'GET, HEAD, OPTIONS'
};

export async function handleAPIRequest(context, handleRequest) {
    if (context.request.method !== "GET" && context.request.method !== "HEAD") {
        return new Response(null, {
            status: 204,
            headers: HEADERS
        });
    }

    return new Response(await handleRequest(context.request, context.env, CACHE_NAME), {
        headers: HEADERS
    });
}

