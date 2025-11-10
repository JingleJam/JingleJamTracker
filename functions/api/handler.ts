import { CacheResponse } from "../types/CacheResponse";
import { Context, Env } from "../types/env";

const CACHE_NAME = 'tiltify-cache-2025';

const HEADERS: Record<string, string> = {
    "content-type": "application/json;charset=UTF-8",
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Allow': 'GET, HEAD, POST, OPTIONS'
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
