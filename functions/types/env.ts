export interface Context {
    request: Request;
    env: Env;  // You can replace 'any' with a more specific type if your env variables have defined structures.
}

export interface Env {
    JINGLE_JAM_DATA: KVNamespace;
    TILTIFY_DATA: DurableObjectNamespace;
    GRAPH_DATA: DurableObjectNamespace;
}