import { Context } from "../../../types/env";
import { ADMIN_METHODS, forwardToDurableObject, handleAPIRequest } from "../../handler";

// GET for this year's timeline, POST (admin only) to replace it
export async function onRequest(context: Context): Promise<Response> {
    return await handleAPIRequest(context, (request, env, cacheName) => forwardToDurableObject(env.GRAPH_DATA, request, cacheName), ADMIN_METHODS);
}
