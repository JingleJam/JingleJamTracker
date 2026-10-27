/**
 * Router utility for handling HTTP paths and methods in a streamlined way
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export type RouteParams = Record<string, string>;

export interface RouteHandler {
    (request: Request, url: URL, params: RouteParams): Promise<Response> | Response;
}

export interface RouteConfig {
    method: HttpMethod;
    path: string;
    handler: RouteHandler;
    requiresAuth?: boolean;
    authToken?: string;
}

export class Router {
    private routes: RouteConfig[] = [];

    /**
     * Register a route with the router
     */
    route(config: RouteConfig): this {
        this.routes.push(config);
        return this;
    }

    /**
     * Register a GET route
     */
    get(path: string, handler: RouteHandler): this {
        return this.route({ method: 'GET', path, handler });
    }

    /**
     * Register a POST route
     */
    post(path: string, handler: RouteHandler, options?: { requiresAuth?: boolean; authToken?: string }): this {
        return this.route({
            method: 'POST',
            path,
            handler,
            requiresAuth: options?.requiresAuth,
            authToken: options?.authToken,
        });
    }

    /**
     * Handle a request by matching it against registered routes
     */
    async handle(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const method = request.method as HttpMethod;

        // Find matching route, noting whether the path exists for another method
        let route: RouteConfig | undefined;
        let params: RouteParams | null = null;
        let pathMatched = false;
        for (const r of this.routes) {
            const match = matchPath(r.path, url.pathname);
            if (!match) {
                continue;
            }
            pathMatched = true;
            if (r.method === method) {
                route = r;
                params = match;
                break;
            }
        }

        if (!route || !params) {
            return pathMatched
                ? errorResponse('Method not allowed.', 405)
                : errorResponse('Not found.', 404);
        }

        // Check authorization if required
        if (route.requiresAuth && !isAuthorized(request, route.authToken)) {
            return errorResponse('Unauthorized.', 401);
        }

        // Execute handler
        try {
            return await route.handler(request, url, params);
        } catch (error) {
            console.error('Route handler error:', error);
            return errorResponse('Internal server error.', 500);
        }
    }
}

export function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

export function errorResponse(error: string, status: number): Response {
    return jsonResponse({ error }, status);
}

/**
 * Check the Authorization header against the admin token, sent either as is or as "Bearer <token>"
 */
function isAuthorized(request: Request, authToken: string | undefined): boolean {
    if (!authToken) {
        return false;
    }

    const requestAuth = (request.headers.get('Authorization') || '').trim();
    const bearer = requestAuth.match(/^Bearer\s+(.+)$/i);
    return (bearer ? bearer[1] : requestAuth) === authToken;
}

/**
 * Match a pathname against a route path, where segments starting with ":" capture a parameter
 * (e.g. "/api/causes/:cause"). Returns the captured parameters, or null if the path does not match.
 */
function matchPath(routePath: string, pathname: string): RouteParams | null {
    const routeSegments = routePath.split('/');
    const pathSegments = pathname.split('/');

    if (routeSegments.length !== pathSegments.length) {
        return null;
    }

    const params: RouteParams = {};
    for (let i = 0; i < routeSegments.length; i++) {
        const routeSegment = routeSegments[i];
        const pathSegment = pathSegments[i];

        if (routeSegment.startsWith(':')) {
            if (!pathSegment) {
                return null;
            }
            try {
                params[routeSegment.slice(1)] = decodeURIComponent(pathSegment);
            } catch {
                return null;
            }
        } else if (routeSegment !== pathSegment) {
            return null;
        }
    }

    return params;
}
