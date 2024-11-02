export interface Env {
    YEAR: number;
    COLLECTIONS_AVAILABLE: number;
    DOLLAR_OFFSET: number;
    DONATION_DIFFERENCE: number;
    CONVERSION_RATE: number;
    CAUSE_SLUG: string;
    FUNDRAISER_SLUG: string;
    FUNDRAISER_PUBLIC_ID: string;
    YOGSCAST_CAMPAIGN_SLUG: string;
    YOGSCAST_USERNAME_SLUG: string;
    DURABLE_OBJECT_CACHE_KEY: string;
    REFRESH_TIME: number;
    ENABLE_REFRESH: boolean;
    ENABLE_GRAPH_REFRESH: boolean;
    ENABLE_DEBUG: boolean;
    ADMIN_TOKEN: string | undefined;
    JINGLE_JAM_DATA: KVNamespace;
    TILTIFY_DATA: DurableObjectNamespace;
}