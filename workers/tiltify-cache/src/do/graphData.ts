import { Env } from "tiltify-cache/types/env";
import { getCacheKey, jsonResponse, roundAmount, Router } from "tiltify-cache/utils";
import { CurrentGraphPoint } from "tiltify-cache/types/CurrentGraphPoint";
import { EventResponse } from "tiltify-cache/responses";
import { EVENT_API_PATH, TIMELINE_API_PATH } from "tiltify-cache/constants";

/*
  Graph Data Durable Object

  This Durable Object is responsible for caching the current graph data points for the Jingle Jam event.
*/
export class GraphData {
    storage: DurableObjectStorage;
    env: Env;
    private router: Router;

    constructor(state: DurableObjectState, env: Env) {
        this.storage = state.storage;
        this.env = env;
        this.router = this.setupRouter();
    }

    private setupRouter(): Router {
        const router = new Router();

        // GET route: Get the current cached graph list
        router.get(TIMELINE_API_PATH, async (request, url) => {
            console.log('Called ' + url.pathname);
            
            let data: any[] | null = await this.storage.get(getCacheKey(this.env.YEAR)) || [];

            // If the cached value is not found (first time load), create a default object and save it to the cache
            if (!data || data.length === 0) {
                data = await this.defaultObject();
                await this.storage.put(getCacheKey(this.env.YEAR), data);
            }

            // Start the alarm if it is currently not started and it should be
            let currentAlarm = await this.storage.getAlarm();
            if (currentAlarm == null && this.env.ENABLE_GRAPH_REFRESH) {
                this.storage.setAlarm(Date.now());
            }

            return jsonResponse(data);
        });

        // POST route: Manually update the current cached graph list
        router.post(
            TIMELINE_API_PATH,
            async (request, url) => {
                console.log('Called ' + url.pathname);
                
                // Set the graph list to the new data manually
                const data = await request.json();
                await this.storage.put(getCacheKey(this.env.YEAR), data);
                return jsonResponse({ success: true });
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
        // Check if the graph refresh is enabled and set the alarm if it is
        if (this.env.ENABLE_GRAPH_REFRESH) {
            this.storage.setAlarm(Date.now() + 60 * 1000);
        }

        console.log('Alarm Called, fetching latest graph data...');

        // Fetch the latest graph data
        const startTime = new Date();
        const graphData = await this.getLatestGraphData();
        const endTime = new Date();

        console.log(`Finished Fetching, caching result graph data... (${endTime.getTime() - startTime.getTime()}ms)`);

        // Cache the latest graph data if it is not null
        if (graphData !== null) {
            await this.storage.put(getCacheKey(this.env.YEAR), graphData);
        }
    }

    // Get the latest, up-to-date graph data points
    async getLatestGraphData(): Promise<CurrentGraphPoint[] | null> {
        // Gets the current tiltify data from the real-time API endpoint
        const tiltifyData = await this.getLatestData();

        // Check if the tiltify data is null or the date is not divisible by the update time frequency
        if (!tiltifyData || new Date(tiltifyData.meta.updatedAt).getMinutes() % (this.env.GRAPH_REFRESH_TIME/60) !== 0) {
            console.log('Skipped alarm...');
            return null;
        }

        //Check if the date is within the event start and end date
        const date = new Date(tiltifyData.meta.updatedAt);
        const startDate = new Date(tiltifyData.meta.event.startsAt);
        const endDate = new Date(tiltifyData.meta.event.endsAt);
        if (date < startDate || date > endDate) {
            return null;
        }

        // Get the previous graph data points
        let graphData: CurrentGraphPoint[] = [];
        try {
            graphData = (await this.storage.get(getCacheKey(this.env.YEAR))) || [];
        } catch (e) { }

        // If the graph data is empty, create a default object
        if (graphData.length === 0) {
            graphData = await this.defaultObject(tiltifyData);
        }
        // Data exists in the graph list, add the new data point
        else {
            const pounds = roundAmount(tiltifyData.raised);
            graphData.push(this.formatGraphData(date, pounds, roundAmount(pounds * tiltifyData.meta.dollarConversionRate)));
        }

        return graphData;
    }

    // Get the default graph data point (either empty list or a 0 point)
    async defaultObject(data?: EventResponse): Promise<CurrentGraphPoint[]> {
        if (!data) {
            data = await this.getLatestData();
        }

        if (!data) {
            return [];
        }

        return [this.formatGraphData(new Date(data.meta.event.startsAt), 0, 0)];
    }

    // Create a graph data point from the tiltify data
    formatGraphData(date: Date, pounds: number, dollars: number): CurrentGraphPoint {
        return {
            "date": date.getTime(),
            "p": pounds,
            "d": dollars
        };
    }

    // Get the latest event data from the TiltifyData Durable Object
    async getLatestData(): Promise<EventResponse> {
        const id = this.env.TILTIFY_DATA.idFromName(getCacheKey(this.env.YEAR));
        const obj = this.env.TILTIFY_DATA.get(id);
        const resp = await obj.fetch("http://127.0.0.1" + EVENT_API_PATH);
        return await resp.json();
    }
}
