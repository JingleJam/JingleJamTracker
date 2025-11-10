
import { Env } from "tiltify-cache/types/env";
import { TILTIFY_API_PATH } from "tiltify-cache/constants";
import { getLatestData } from "tiltify-cache/api";
import { ApiResponse } from "tiltify-cache/types/ApiResponse";

export class TiltifyData {
    storage: DurableObjectStorage;
    env: Env;

    constructor(state: DurableObjectState, env: Env) {
        this.storage = state.storage;
        this.env = env;
    }

    // Handle HTTP requests from clients.
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        console.log('Called ' + url.pathname);

        if (request.method === 'GET' && url.pathname === TILTIFY_API_PATH) {
            // Get the current cached value
            let data: ApiResponse | undefined = await this.storage.get(this.env.DURABLE_OBJECT_CACHE_KEY);

            // Start the alarm if it is currently not started
            let currentAlarm = await this.storage.getAlarm();
            if (currentAlarm == null && this.env.ENABLE_REFRESH) {
                this.storage.setAlarm(Date.now() + (this.env.LIVE_REFRESH_TIME * 1000));
            }

            // If the cached value is null, fetch the latest data and save it to the cache
            if (!data) {
                data = await getLatestData(this.env);

                await this.storage.put(this.env.DURABLE_OBJECT_CACHE_KEY, data);
            }

            return new Response(JSON.stringify(data));
        }
        // Manually update the current cached tiltify data 
        else if (request.method === 'POST' && url.pathname === TILTIFY_API_PATH) {
            // Check if the request is authorized
            if (!this.env.ADMIN_TOKEN || request.headers.get('Authorization') !== this.env.ADMIN_TOKEN) {
                return new Response("Unauthorized", { status: 401 });
            }

            const data = await request.json();
            await this.storage.put(this.env.DURABLE_OBJECT_CACHE_KEY, data);
            return new Response("Manual Update Success", { status: 200 });
        }

        // Invalid API Endpoint
        return new Response("Not found", { status: 404 });
    }

    async alarm(): Promise<void> {
        if (this.env.ENABLE_REFRESH) {
            this.storage.setAlarm(Date.now() + (this.env.LIVE_REFRESH_TIME * 1000));
        }

        console.log('Alarm Called, fetching latest Tiltify data...');

        const startTime = new Date();
        const newData = await getLatestData(this.env);
        const endTime = new Date();

        console.log(`Finished Fetching, caching result Tiltify data... (${endTime.getTime() - startTime.getTime()}ms)`);

        // Get the current cached value
        let data: ApiResponse | undefined = await this.storage.get(this.env.DURABLE_OBJECT_CACHE_KEY);

        // Update the cached value if it's valid
        if(newData && (
            !data ||                                                             // If the cached value is null
            !(newData?.raised?.yogscast == 0 && data?.raised?.yogscast !== 0)    // If the raised amount it not valid
        )) {
            // Check if the campaigns failed to load, if so, keep the old data
            if(data && (newData.campaigns.count === 0 && data.campaigns.count > 0)) {
                console.log(`Campaigns failed to load... Keeping old data`);

                newData.campaigns = data.campaigns;
                newData.causes = data.causes;
            }

            await this.storage.put(this.env.DURABLE_OBJECT_CACHE_KEY, newData);
        }

        console.log(`Finished Caching data... (${new Date().getTime() - endTime.getTime()}ms)`);
    }
}
