/**
 * Router utility for handling HTTP paths and methods in a streamlined way
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export interface RouteHandler {
    (request: Request, url: URL): Promise<Response> | Response;
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
        const route = this.routes.find(
            r => r.method === method && r.path === url.pathname
        );

        if (!route) {
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
            return await route.handler(request, url);
        } catch (error) {
            console.error('Route handler error:', error);
            return new Response("Internal Server Error", { status: 500 });
        }
    }
}

