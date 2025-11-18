import { Env } from "tiltify-cache/types/env";
import { roundAmount } from "tiltify-cache/utils";
import { CurrentGraphPoint } from "tiltify-cache/types/CurrentGraphPoint";
import { ApiResponse } from "tiltify-cache/types/ApiResponse";
import { GRAPH_API_PATH, TILTIFY_API_PATH } from "tiltify-cache/constants";

/*
  Graph Data Durable Object

  This Durable Object is responsible for caching the current graph data points for the Jingle Jam event.
*/
export class GraphData {
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

        // Get the current cached graph list
        if (request.method === 'GET' && url.pathname === GRAPH_API_PATH) {
            let data: any[] | null = await this.storage.get(this.env.DURABLE_OBJECT_CACHE_KEY) || [];

            // If the cached value is not found first time load), create a default object and save it to the cache
            if (!data || data.length === 0) {
                data = await this.defaultObject();
                await this.storage.put(this.env.DURABLE_OBJECT_CACHE_KEY, data);
            }

            // Start the alarm if it is currently not started and it should be
            let currentAlarm = await this.storage.getAlarm();
            if (currentAlarm == null && this.env.ENABLE_GRAPH_REFRESH) {
                this.storage.setAlarm(Date.now());
            }

            return new Response(JSON.stringify(data));
        }
        // Manually update the current cached graph list
        else if (request.method === 'POST' && url.pathname === GRAPH_API_PATH) {
            // Check if the request is authorized
            if (!this.env.ADMIN_TOKEN || request.headers.get('Authorization') !== this.env.ADMIN_TOKEN) {
                return new Response("Unauthorized", { status: 401 });
            }

            // Set the graph list to the new data manually
            const data = await request.json();
            await this.storage.put(this.env.DURABLE_OBJECT_CACHE_KEY, data);
            return new Response("Manual Update Success", { status: 200 });
        }

        return new Response("Not found", { status: 404 });
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
            await this.storage.put(this.env.DURABLE_OBJECT_CACHE_KEY, graphData);
        }
    }

    // Get the latest, up-to-date graph data points
    async getLatestGraphData(): Promise<CurrentGraphPoint[] | null> {
        // Gets the current tiltify data from the real-time API endpoint
        const tiltifyData = await this.getLatestData();

        // Check if the tiltify data is null or the date is not divisible by the update time frequency
        if (!tiltifyData || new Date(tiltifyData.date).getMinutes() % (this.env.GRAPH_REFRESH_TIME/60) !== 0) {
            console.log('Skipped alarm...');
            return null;
        }

        //Check if the date is within the event start and end date
        const date = new Date(tiltifyData.date);
        const startDate = new Date(tiltifyData.event.start);
        const endDate = new Date(tiltifyData.event.end);
        if (date < startDate || date > endDate) {
            return null;
        }

        // Get the previous graph data points
        let graphData: CurrentGraphPoint[] = [];
        try {
            graphData = (await this.storage.get(this.env.DURABLE_OBJECT_CACHE_KEY)) || [];
        } catch (e) { }

        // If the graph data is empty, create a default object
        if (graphData.length === 0) {
            graphData = await this.defaultObject(tiltifyData);
        }
        // Data exists in the graph list, add the new data point
        else {
            const pounds = roundAmount(tiltifyData.raised.yogscast + tiltifyData.raised.fundraisers);
            graphData.push(this.formatGraphData(date, pounds, roundAmount(pounds * tiltifyData.dollarConversionRate)));
        }

        return graphData;
    }

    // Get the default graph data point (either empty list or a 0 point)
    async defaultObject(data?: ApiResponse): Promise<CurrentGraphPoint[]> {
        if (!data) {
            data = await this.getLatestData();
        }

        if (!data) {
            return [];
        }

        return [this.formatGraphData(new Date(data.event.start), 0, 0)];
    }

    // Create a graph data point from the tiltify data
    formatGraphData(date: Date, pounds: number, dollars: number): CurrentGraphPoint {
        return {
            "date": date.getTime(),
            "p": pounds,
            "d": dollars
        };
    }

    // Get the latest tiltify data from the real-time API endpoint
    async getLatestData(): Promise<ApiResponse> {
        const id = this.env.TILTIFY_DATA.idFromName(this.env.DURABLE_OBJECT_CACHE_KEY);
        const obj = this.env.TILTIFY_DATA.get(id);
        const resp = await obj.fetch("http://127.0.0.1" + TILTIFY_API_PATH);
        return await resp.json();
    }
}
