export interface Context {
    request: Request;
    env: Env;
}

export interface Env {
    JINGLE_JAM_DATA: KVNamespace;
    TILTIFY_DATA: DurableObjectNamespace;
    GRAPH_DATA: DurableObjectNamespace;
}