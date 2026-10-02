import { Context } from "../../types/env";
import { forwardToDurableObject, handleAPIRequest } from "../handler";

export async function onRequest(context: Context): Promise<Response> {
    return await handleAPIRequest(context, (request, env, cacheName) => forwardToDurableObject(env.GRAPH_DATA, request, cacheName));
}
