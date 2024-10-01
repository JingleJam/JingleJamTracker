import { Context, Env } from "../types/env";

const CACHE_NAME = 'tiltify-cache-2024';

const HEADERS: Record<string, string> = {
    "content-type": "application/json;charset=UTF-8",
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Allow': 'GET, HEAD, OPTIONS'
};

export async function handleAPIRequest(context: Context, handleRequest: (request: Request, env: Env, cacheName: string) => Promise<string>): Promise<Response> {
    if (context.request.method !== "GET" && context.request.method !== "HEAD") {
        return new Response(null, {
            status: 204,
            headers: HEADERS
        });
    }

    const responseData = await handleRequest(context.request, context.env, CACHE_NAME);
    return new Response(responseData, {
        headers: HEADERS
    });
}
