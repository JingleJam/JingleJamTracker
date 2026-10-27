import { CacheResponse } from "../types/CacheResponse";
import { Context, Env } from "../types/env";

const CACHE_NAME = 'tiltify-cache-2025';

export const PUBLIC_METHODS = ['GET', 'OPTIONS'];           // Methods allowed on the public endpoints
export const ADMIN_METHODS = ['GET', 'POST', 'OPTIONS'];    // Methods allowed on the endpoints that also have an admin POST

export function getCorsHeaders(methods: string[] = PUBLIC_METHODS): Record<string, string> {
    const allowed = methods.join(', ');
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': allowed,
        'Access-Control-Max-Age': '86400',
        'Allow': allowed
    };
}

function getHeaders(methods: string[]): Record<string, string> {
    return {
        "content-type": "application/json;charset=UTF-8",
        ...getCorsHeaders(methods)
    };
}

export async function handleAPIRequest(context: Context, handleRequest: (request: Request, env: Env, cacheName: string) => Promise<CacheResponse>, methods: string[] = PUBLIC_METHODS): Promise<Response> {
    const headers = getHeaders(methods);

    if (context.request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers
        });
    }

    try {
        const response = await handleRequest(context.request, context.env, CACHE_NAME);
        return new Response(response.data, {
            status: response.status,
            headers
        });
    } catch (e) {
        console.error('API request failed', e);
        return new Response(JSON.stringify({ error: 'Internal server error.' }), {
            status: 500,
            headers
        });
    }
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
export async function forwardToTiltifyData(context: Context, methods: string[] = PUBLIC_METHODS): Promise<Response> {
    return await handleAPIRequest(context, (request, env, cacheName) => forwardToDurableObject(env.TILTIFY_DATA, request, cacheName), methods);
}

// Respond with a JSON 404 for a path that isn't an endpoint
export async function notFound(context: Context): Promise<Response> {
    return await handleAPIRequest(context, async () => ({
        data: JSON.stringify({ error: 'Not found.' }),
        status: 404
    }));
}

// Permanently redirect to a new path, keeping the query string. A 308 keeps the method and body.
export function redirect(context: Context, pathname: string, methods: string[] = PUBLIC_METHODS): Response {
    if (context.request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: getCorsHeaders(methods)
        });
    }

    const url = new URL(context.request.url);
    url.pathname = pathname;

    return new Response(null, {
        status: 308,
        headers: { ...getCorsHeaders(methods), 'Location': url.toString() }
    });
}
