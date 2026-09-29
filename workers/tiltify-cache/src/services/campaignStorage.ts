import { Campaign } from "tiltify-cache/types/Campaign";

// Legacy keys from when the full campaign list was chunked into Durable Object storage
const LEGACY_CHUNK_KEY_PREFIX = 'fullCampaigns:';
const LEGACY_CHUNK_META_KEY = 'fullCampaigns:meta';
const MAX_DELETE_KEYS = 128; // Durable Object storage.delete() accepts at most 128 keys per call

/**
 * Campaign Storage Service
 *
 * Persists the full campaign list as a single KV value. KV bills per operation rather than per byte
 * (values up to 25 MiB), so one large write is far cheaper than chunked Durable Object storage writes.
 *
 * The live list is held in the TiltifyData Durable Object's memory; this is only a snapshot used to
 * serve campaigns after a cold start until the next Tiltify refresh completes.
 */
export class CampaignStorageService {
    private kv: KVNamespace;
    private key: string;

    constructor(kv: KVNamespace, year: number) {
        this.kv = kv;
        this.key = `campaigns-${year}`;
    }

    /**
     * Store the full campaign list
     */
    async storeCampaigns(campaigns: Campaign[]): Promise<void> {
        await this.kv.put(this.key, JSON.stringify(campaigns));
    }

    /**
     * Retrieve the full campaign list, or an empty list if none is stored
     */
    async getCampaigns(): Promise<Campaign[]> {
        return (await this.kv.get<Campaign[]>(this.key, 'json')) || [];
    }

    /**
     * Delete the legacy chunked campaign list from Durable Object storage, if it still exists
     */
    static async deleteLegacyChunks(storage: DurableObjectStorage): Promise<void> {
        const meta = await storage.get<{ total: number; chunkCount: number }>(LEGACY_CHUNK_META_KEY);
        if (!meta) {
            return;
        }

        const keys = Array.from({ length: meta.chunkCount }, (_, i) => `${LEGACY_CHUNK_KEY_PREFIX}${i}`);
        for (let i = 0; i < keys.length; i += MAX_DELETE_KEYS) {
            await storage.delete(keys.slice(i, i + MAX_DELETE_KEYS));
        }
        await storage.delete(LEGACY_CHUNK_META_KEY);
    }
}
