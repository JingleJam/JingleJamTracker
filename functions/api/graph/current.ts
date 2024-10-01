import { Context, Env } from "../../types/env";
import { handleAPIRequest } from "../handler";

export async function onRequest(context: Context): Promise<Response> {
    return await handleAPIRequest(context, handleRequest);
}

async function handleRequest(request: Request, env: Env, cacheName: string): Promise<string> {
    let response = '';

    const id = env.GRAPH_DATA.idFromName(cacheName);
    const obj = env.GRAPH_DATA.get(id);
    const resp = await obj.fetch(request.url);
    response = await resp.text();

    return response;
}