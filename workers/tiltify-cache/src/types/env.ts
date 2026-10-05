export interface Env {
    YEAR: number;
    COLLECTIONS_AVAILABLE: number;
    DOLLAR_OFFSET: number;
    DONATION_DIFFERENCE: number;
    CONVERSION_RATE: number;
    FUNDRAISER_PUBLIC_ID: string;
    ALL_CHARITIES_REGION_ID: string;
    YOGSCAST_USERNAME: string;
    LIVE_REFRESH_TIME: number;
    ENABLE_REFRESH: boolean;
    GRAPH_REFRESH_TIME: number;
    ENABLE_GRAPH_REFRESH: boolean;
    ENABLE_DEBUG: boolean;
    ADMIN_TOKEN: string | undefined;
    JINGLE_JAM_DATA: KVNamespace;
    TILTIFY_DATA: DurableObjectNamespace;
}