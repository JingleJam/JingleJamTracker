import { Env } from "tiltify-cache/types/env";
import {
    TILTIFY_API_PATH,
    CAMPAIGNS_API_PATH,
    SNAPSHOT_INTERVAL_MS,
    IDLE_REFRESH_TIME,
    EVENT_WINDOW_PADDING_MS
} from "tiltify-cache/constants";
import { getLatestData } from "tiltify-cache/api";
import { ApiResponse } from "tiltify-cache/types/ApiResponse";
import { getCacheKey, Router } from "tiltify-cache/utils";
import { Campaign } from "tiltify-cache/types/Campaign";
import { CampaignStorageService } from "tiltify-cache/services/campaignStorage";

const MAIN_CAMPAIGN_LIMIT = 100; // Number of campaigns included in the main cached response

/*
  Tiltify Data Durable Object

  The live data is held in memory and refreshed by an alarm, so API requests never touch storage.
  Snapshots are persisted at most every SNAPSHOT_INTERVAL_MS, and only when the data has changed:
    - The main response (top campaigns) goes to Durable Object storage
    - The full campaign list goes to a single KV value
  Snapshots are only read after a cold start, until the first refresh completes.
*/
export class TiltifyData {
    storage: DurableObjectStorage;
    env: Env;
    private router: Router;
    private campaignStorage: CampaignStorageService;

    private summary: ApiResponse | null = null;             // Main response served by the Tiltify API path
    private campaigns: Campaign[] | null = null;            // Full sorted campaign list served by the Campaigns API path
    private refreshing: Promise<void> | null = null;        // In-flight refresh, shared by concurrent callers
    private alarmChecked = false;
    private lastSnapshot = 0;
    private summaryHash: string | null = null;
    private campaignsHash: string | null = null;

    constructor(state: DurableObjectState, env: Env) {
        this.storage = state.storage;
        this.env = env;
        this.campaignStorage = new CampaignStorageService(env.JINGLE_JAM_DATA, env.YEAR);
        this.router = this.setupRouter();

        state.blockConcurrencyWhile(async () => {
            this.summary = await this.storage.get<ApiResponse>(getCacheKey(this.env.YEAR)) || null;
            if (this.summary) {
                this.summaryHash = await hashSummary(this.summary);
            }

            try {
                await CampaignStorageService.deleteLegacyChunks(this.storage);
            } catch (e) {
                console.error('Failed to delete legacy campaign chunks', e);
            }
        });
    }

    private setupRouter(): Router {
        const router = new Router();

        // GET route: Get the current cached value
        router.get(TILTIFY_API_PATH, async (request, url) => {
            console.log('Called ' + url.pathname);

            await this.ensureAlarm();

            // If there is no cached value (first time load), fetch the latest data
            if (!this.summary) {
                await this.refresh();
            }

            return new Response(JSON.stringify(this.summary));
        });

        // GET route: Get paginated campaigns list
        router.get(CAMPAIGNS_API_PATH, async (request, url) => {
            console.log('Called ' + url.pathname);

            // Parse query parameters
            const limitParam = url.searchParams.get('limit');
            const offsetParam = url.searchParams.get('offset');

            // Validate limit parameter
            if (limitParam !== null) {
                const limitValue = parseInt(limitParam, 10);
                if (isNaN(limitValue) || limitValue < 1 || limitValue > 100) {
                    return new Response(JSON.stringify({
                        error: 'Invalid limit parameter. Limit must be between 1 and 100.'
                    }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            }

            // Validate offset parameter
            if (offsetParam !== null) {
                const offsetValue = parseInt(offsetParam, 10);
                if (isNaN(offsetValue) || offsetValue < 0) {
                    return new Response(JSON.stringify({
                        error: 'Invalid offset parameter. Offset must be a positive number (0 or greater).'
                    }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            }

            // Default values: limit 100, offset 0
            const limit = limitParam ? parseInt(limitParam, 10) : 100;
            const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

            await this.ensureAlarm();

            // After a cold start, serve the KV snapshot until the next refresh, or fetch if there is none
            if (!this.campaigns) {
                const snapshot = await this.campaignStorage.getCampaigns();
                if (!this.campaigns && snapshot.length > 0) {
                    this.campaigns = snapshot;
                }
            }
            if (!this.campaigns) {
                await this.refresh();
            }

            const fullCampaigns = this.campaigns || [];

            // Apply pagination
            const paginatedCampaigns = fullCampaigns.slice(offset, offset + limit);

            return new Response(JSON.stringify({
                campaigns: paginatedCampaigns,
                total: fullCampaigns.length,
                limit,
                offset
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        });

        // POST route: Manually update the current cached tiltify data
        router.post(
            TILTIFY_API_PATH,
            async (request, url) => {
                console.log('Called ' + url.pathname);

                const data: ApiResponse = await request.json();
                this.summary = data;
                this.summaryHash = await hashSummary(data);
                await this.storage.put(getCacheKey(this.env.YEAR), data);
                return new Response("Manual Update Success", { status: 200 });
            },
            {
                requiresAuth: true,
                authToken: this.env.ADMIN_TOKEN,
            }
        );

        return router;
    }

    // Handle HTTP requests from clients.
    async fetch(request: Request): Promise<Response> {
        return this.router.handle(request);
    }

    async alarm(): Promise<void> {
        // Schedule the next alarm first so a failed refresh doesn't stop the loop
        this.scheduleNextAlarm();

        console.log('Alarm Called, fetching latest Tiltify data...');

        const startTime = new Date();
        await this.refresh();

        console.log(`Finished refreshing Tiltify data... (${new Date().getTime() - startTime.getTime()}ms)`);
    }

    // Start the alarm if it is currently not started (checked once per instance)
    private async ensureAlarm(): Promise<void> {
        if (this.alarmChecked) {
            return;
        }
        this.alarmChecked = true;

        const currentAlarm = await this.storage.getAlarm();
        if (currentAlarm == null) {
            this.scheduleNextAlarm();
        }
    }

    // Refresh every LIVE_REFRESH_TIME seconds during the event window, and every IDLE_REFRESH_TIME seconds outside it
    private scheduleNextAlarm(): void {
        if (!this.env.ENABLE_REFRESH) {
            return;
        }

        let refreshTime = this.env.LIVE_REFRESH_TIME;
        if (this.summary) {
            const now = Date.now();
            const start = new Date(this.summary.event.start).getTime() - EVENT_WINDOW_PADDING_MS;
            const end = new Date(this.summary.event.end).getTime() + EVENT_WINDOW_PADDING_MS;
            if (now < start || now > end) {
                refreshTime = IDLE_REFRESH_TIME;
            }
        }

        this.storage.setAlarm(Date.now() + (refreshTime * 1000));
    }

    // Fetch the latest data into memory, sharing a single in-flight fetch between concurrent callers
    private refresh(): Promise<void> {
        if (!this.refreshing) {
            this.refreshing = this.fetchLatestData().finally(() => {
                this.refreshing = null;
            });
        }
        return this.refreshing;
    }

    private async fetchLatestData(): Promise<void> {
        const newData = await getLatestData(this.env);

        // Keep the current data if the raised amount is not valid
        if (!newData || (this.summary && newData.raised === 0 && this.summary.raised !== 0)) {
            console.log(`Raised amount invalid... Keeping old data`);
            return;
        }

        // Check if the campaigns failed to load, if so, keep the old campaigns
        if (this.summary && newData.campaigns.count === 0 && this.summary.campaigns.count > 0) {
            console.log(`Campaigns failed to load... Keeping old data`);

            newData.campaigns = this.summary.campaigns;
            newData.causes = this.summary.causes;
        } else {
            this.campaigns = newData.campaigns.list;

            // Truncate the campaigns list for the main cache
            newData.campaigns.list = newData.campaigns.list.slice(0, MAIN_CAMPAIGN_LIMIT);
        }

        this.summary = newData;

        try {
            await this.persistSnapshots();
        } catch (e) {
            console.error('Failed to persist snapshots', e);
        }
    }

    // Persist the in-memory data for cold starts, at most every SNAPSHOT_INTERVAL_MS and only if it changed
    private async persistSnapshots(): Promise<void> {
        const now = Date.now();
        if (now - this.lastSnapshot < SNAPSHOT_INTERVAL_MS) {
            return;
        }
        this.lastSnapshot = now;

        if (this.summary) {
            const summaryHash = await hashSummary(this.summary);
            if (summaryHash !== this.summaryHash) {
                await this.storage.put(getCacheKey(this.env.YEAR), this.summary);
                this.summaryHash = summaryHash;
            }
        }

        if (this.campaigns && this.campaigns.length > 0) {
            const campaignsHash = await hash(this.campaigns);
            if (campaignsHash !== this.campaignsHash) {
                await this.campaignStorage.storeCampaigns(this.campaigns);
                this.campaignsHash = campaignsHash;
            }
        }
    }
}

// Hash of the main response, ignoring the fetch date which changes on every refresh
function hashSummary(summary: ApiResponse): Promise<string> {
    return hash({ ...summary, date: null });
}

async function hash(value: unknown): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
