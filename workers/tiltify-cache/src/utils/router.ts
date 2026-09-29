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

        // Find matching route
        let route: RouteConfig | undefined;
        let params: RouteParams | null = null;
        for (const r of this.routes) {
            if (r.method !== method) {
                continue;
            }
            params = matchPath(r.path, url.pathname);
            if (params) {
                route = r;
                break;
            }
        }

        if (!route || !params) {
            return new Response("Not found", { status: 404 });
        }

        // Check authorization if required
        if (route.requiresAuth) {
            const authToken = route.authToken || '';
            const requestAuth = request.headers.get('Authorization');
            
            if (!authToken || requestAuth !== authToken) {
                return new Response("Unauthorized", { status: 401 });
            }
        }

        // Execute handler
        try {
            return await route.handler(request, url, params);
        } catch (error) {
            console.error('Route handler error:', error);
            return new Response("Internal Server Error", { status: 500 });
        }
    }
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
