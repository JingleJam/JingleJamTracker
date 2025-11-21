import { Campaign } from "tiltify-cache/types/Campaign";

const MAX_VALUE_SIZE = 128 * 1024; // 128 KiB limit for key-value storage
const CHUNK_KEY_PREFIX = 'fullCampaigns:';
const CHUNK_META_KEY = 'fullCampaigns:meta';

/**
 * Campaign Storage Service
 * 
 * Handles storing and retrieving campaigns in chunks to work around the 128 KiB
 * value size limit of key-value backed Durable Objects.
 */
export class CampaignStorageService {
    private storage: DurableObjectStorage;

    constructor(storage: DurableObjectStorage) {
        this.storage = storage;
    }

    /**
     * Store campaigns in chunks to work around the 128 KiB value size limit
     */
    async storeCampaigns(campaigns: Campaign[]): Promise<void> {
        // Delete old chunks first
        const existingChunks = await this.storage.list({ prefix: CHUNK_KEY_PREFIX });
        for (const [key] of existingChunks) {
            await this.storage.delete(key);
        }

        if (campaigns.length === 0) {
            await this.storage.put(CHUNK_META_KEY, { total: 0, chunkCount: 0 });
            return;
        }

        // Try to fit campaigns into chunks, ensuring each chunk is under 128KB
        // We need to account for JSON array overhead (brackets, commas) - reserve ~1KB buffer
        const SAFE_CHUNK_SIZE = MAX_VALUE_SIZE - 1024; // Reserve 1KB for array overhead
        const chunks: Campaign[][] = [];
        let currentChunk: Campaign[] = [];
        let currentChunkSize = 0;

        for (const campaign of campaigns) {
            const campaignSize = JSON.stringify(campaign).length;
            // Account for comma separator (add 1 byte per campaign after the first)
            const sizeWithOverhead = currentChunk.length > 0 
                ? currentChunkSize + campaignSize + 1 // +1 for comma
                : currentChunkSize + campaignSize;
            
            // If adding this campaign would exceed the safe limit, start a new chunk
            if (sizeWithOverhead > SAFE_CHUNK_SIZE && currentChunk.length > 0) {
                chunks.push(currentChunk);
                currentChunk = [campaign];
                currentChunkSize = campaignSize;
            } else {
                currentChunk.push(campaign);
                currentChunkSize = sizeWithOverhead;
            }
        }

        // Don't forget the last chunk
        if (currentChunk.length > 0) {
            chunks.push(currentChunk);
        }

        // Store each chunk
        const storageOps: Promise<void>[] = [];
        for (let i = 0; i < chunks.length; i++) {
            storageOps.push(this.storage.put(`${CHUNK_KEY_PREFIX}${i}`, chunks[i]));
        }

        // Store metadata
        storageOps.push(this.storage.put(CHUNK_META_KEY, { 
            total: campaigns.length, 
            chunkCount: chunks.length 
        }));

        await Promise.all(storageOps);
    }

    /**
     * Retrieve all campaigns from chunks
     */
    async getCampaigns(): Promise<Campaign[]> {
        const meta = await this.storage.get<{ total: number; chunkCount: number }>(CHUNK_META_KEY);
        
        if (!meta || meta.chunkCount === 0) {
            return [];
        }

        // Fetch all chunks in parallel
        const chunkPromises: Promise<Campaign[] | undefined>[] = [];
        for (let i = 0; i < meta.chunkCount; i++) {
            chunkPromises.push(this.storage.get<Campaign[]>(`${CHUNK_KEY_PREFIX}${i}`));
        }

        const chunks = await Promise.all(chunkPromises);
        
        // Combine all chunks
        const campaigns: Campaign[] = [];
        for (const chunk of chunks) {
            if (chunk) {
                campaigns.push(...chunk);
            }
        }

        return campaigns;
    }
}

