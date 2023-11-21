import { handleAPIRequest } from "../handler";

export async function onRequest(context) {
    return await handleAPIRequest(context, handleRequest);
}

async function handleRequest(request, env, cacheName) {
    let response = '';

    let id = env.GRAPH_DATA.idFromName(cacheName);
    let obj = env.GRAPH_DATA.get(id);
    let resp = await obj.fetch(request.url);
    response = await resp.text();

    return response
}