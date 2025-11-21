import { Env } from "tiltify-cache/types/env";
import { TILTIFY_API_PATH, CAMPAIGNS_API_PATH } from "tiltify-cache/constants";
import { getLatestData } from "tiltify-cache/api";
import { ApiResponse } from "tiltify-cache/types/ApiResponse";
import { Router } from "tiltify-cache/utils";
import { Campaign } from "tiltify-cache/types/Campaign";
import { CampaignStorageService } from "tiltify-cache/services/campaignStorage";

export class TiltifyData {
    storage: DurableObjectStorage;
    env: Env;
    private router: Router;
    private campaignStorage: CampaignStorageService;

    constructor(state: DurableObjectState, env: Env) {
        this.storage = state.storage;
        this.env = env;
        this.campaignStorage = new CampaignStorageService(state.storage);
        this.router = this.setupRouter();
    }

    private setupRouter(): Router {
        const router = new Router();

        // GET route: Get the current cached value
        router.get(TILTIFY_API_PATH, async (request, url) => {
            console.log('Called ' + url.pathname);
            
            let data: ApiResponse | undefined = await this.storage.get(this.env.DURABLE_OBJECT_CACHE_KEY);

            // Start the alarm if it is currently not started
            let currentAlarm = await this.storage.getAlarm();
            if (currentAlarm == null && this.env.ENABLE_REFRESH) {
                this.storage.setAlarm(Date.now() + (this.env.LIVE_REFRESH_TIME * 1000));
            }

            // If the cached value is null, fetch the latest data and save it to the cache
            if (!data) {
                data = await this.fetchLatestData();
                await this.storage.put(this.env.DURABLE_OBJECT_CACHE_KEY, data);
            }

            return new Response(JSON.stringify(data));
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

            // Get the full campaigns list from storage
            let fullCampaigns = await this.campaignStorage.getCampaigns();
            
            if (!fullCampaigns || fullCampaigns.length === 0) {
                // If no campaigns are stored, fetch them
                await this.fetchLatestData();
                fullCampaigns = await this.campaignStorage.getCampaigns();
                
                if (!fullCampaigns || fullCampaigns.length === 0) {
                    return new Response(JSON.stringify({
                        campaigns: [],
                        total: 0,
                        limit,
                        offset
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            }

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
                
                const data = await request.json();
                await this.storage.put(this.env.DURABLE_OBJECT_CACHE_KEY, data);
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
        if (this.env.ENABLE_REFRESH) {
            this.storage.setAlarm(Date.now() + (this.env.LIVE_REFRESH_TIME * 1000));
        }

        console.log('Alarm Called, fetching latest Tiltify data...');

        const startTime = new Date();
        const newData = await this.fetchLatestData();
        const endTime = new Date();

        console.log(`Finished Fetching, caching result Tiltify data... (${endTime.getTime() - startTime.getTime()}ms)`);

        // Get the current cached value
        let data: ApiResponse | undefined = await this.storage.get(this.env.DURABLE_OBJECT_CACHE_KEY);
        const oldFullCampaigns = await this.campaignStorage.getCampaigns();

        // Update the cached value if it's valid
        if(newData && (
            !data ||                                          // If the cached value is null
            !(newData?.raised === 0 && data?.raised !== 0)    // If the raised amount it not valid
        )) {
            // Check if the campaigns failed to load, if so, keep the old data
            if(data && (newData.campaigns.count === 0 && data.campaigns.count > 0)) {
                console.log(`Campaigns failed to load... Keeping old data`);

                newData.campaigns = data.campaigns;
                newData.causes = data.causes;
                
                // Preserve the old fullCampaigns if they exist
                if (oldFullCampaigns && oldFullCampaigns.length > 0) {
                    await this.campaignStorage.storeCampaigns(oldFullCampaigns);
                }
            }

            await this.storage.put(this.env.DURABLE_OBJECT_CACHE_KEY, newData);
        }

        console.log(`Finished Caching data... (${new Date().getTime() - endTime.getTime()}ms)`);
    }

    async fetchLatestData(): Promise<ApiResponse> {
        let data = await getLatestData(this.env);
        let fullCampaigns = data.campaigns.list;

        // Store the full campaigns list using the campaign storage service
        // Only store if we have campaigns (don't overwrite with empty if fetch failed)
        if (fullCampaigns && fullCampaigns.length > 0) {
            await this.campaignStorage.storeCampaigns(fullCampaigns);
        }

        // Truncate the campaigns list to the first 100 campaigns for the main cache
        data.campaigns.list = data.campaigns.list.slice(0, 100);

        return data;
    }
}
