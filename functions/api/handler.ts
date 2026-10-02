import { CacheResponse } from "../types/CacheResponse";
import { Context, Env } from "../types/env";

const CACHE_NAME = 'tiltify-cache-2025';

export const CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Allow': 'GET, HEAD, POST, OPTIONS'
};

const HEADERS: Record<string, string> = {
    "content-type": "application/json;charset=UTF-8",
    ...CORS_HEADERS
};

export async function handleAPIRequest(context: Context, handleRequest: (request: Request, env: Env, cacheName: string) => Promise<CacheResponse>): Promise<Response> {
    if (context.request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: HEADERS
        });
    }
    const response = await handleRequest(context.request, context.env, CACHE_NAME);
    return new Response(response.data, {
        status: response.status,
        headers: HEADERS
    });
}

// Forward the request to the Durable Object instance for the cache, which routes it by path
export async function forwardToDurableObject(namespace: DurableObjectNamespace, request: Request, cacheName: string): Promise<CacheResponse> {
    const id = namespace.idFromName(cacheName);
    const obj = namespace.get(id);
    const resp = await obj.fetch(request);

    return {
        data: await resp.text(),
        status: resp.status
    };
}

// Handle a request by forwarding it to the TiltifyData Durable Object
export async function forwardToTiltifyData(context: Context): Promise<Response> {
    return await handleAPIRequest(context, (request, env, cacheName) => forwardToDurableObject(env.TILTIFY_DATA, request, cacheName));
}
