import { getLatestData } from "./api";
import { Env } from "./env";
import { roundAmount } from "./utils";
import { CurrentGraphPoint } from "./types/CurrentGraphPoint";
import { ApiResponse } from "./types/ApiResponse";

const UPDATE_TIME_GRAPH = 60 * 1000; // Refresh cache every 60 seconds
const UPDATE_TIME_FREQ = 10; // Refresh graph every 10 minutes

const DO_CACHE_KEY = 'tiltify-cache'; // Key to store the cache
const CACHE_NAME = 'tiltify-cache-2023'; // Cache Object Name

const TILTIFY_API_PATH = '/api/tiltify'; // API Path for the Tiltify Cache
const GRAPH_API_PATH = '/api/graph/current'; // API Path for the Graph Data

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
      let data = await this.storage.get(DO_CACHE_KEY);

      // Start the alarm if it is currently not started
      let currentAlarm = await this.storage.getAlarm();
      if (currentAlarm == null && this.env.ENABLE_REFRESH) {
        this.storage.setAlarm(Date.now() + (this.env.REFRESH_TIME * 1000));
      }

      // If the cached value is null, fetch the latest data and save it to the cache
      if (!data) {
        data = await getLatestData(this.env);

        if (this.env.ENABLE_REFRESH) {
          await this.storage.put(DO_CACHE_KEY, data);
        }
      }

      return new Response(JSON.stringify(data));
    }
    // Manually update the current cached tiltify data 
    else if (request.method === 'POST' && url.pathname === TILTIFY_API_PATH) {
      // Check if the request is authorized
      if(!this.env.ADMIN_TOKEN || request.headers.get('Authorization') !== this.env.ADMIN_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }
      
      const data = await request.json();
      await this.storage.put(DO_CACHE_KEY, data);
      return new Response("Manual Update Success", { status: 200 });
    }

    // Invalid API Endpoint
    return new Response("Not found", { status: 404 });
  }

  async alarm(): Promise<void> {
    if (this.env.ENABLE_REFRESH) {
      this.storage.setAlarm(Date.now() + (this.env.REFRESH_TIME * 1000));
    }

    console.log('Alarm Called, fetching latest Tiltify data...');

    const startTime = new Date();
    const newData = await getLatestData(this.env);
    const endTime = new Date();

    console.log(`Finished Fetching, caching result Tiltify data... (${endTime.getTime() - startTime.getTime()}ms)`);

    await this.storage.put(DO_CACHE_KEY, newData);

    console.log(`Finished Caching data... (${new Date().getTime() - endTime.getTime()}ms)`);
  }
}

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
      let data = await this.storage.get(DO_CACHE_KEY) || null;

      if (!data) {
        data = await this.defaultObject();
        await this.storage.put(DO_CACHE_KEY, data);
      }

      let currentAlarm = await this.storage.getAlarm();
      if (currentAlarm == null && this.env.ENABLE_GRAPH_REFRESH) {
        this.storage.setAlarm(Date.now() + UPDATE_TIME_GRAPH);
      }

      return new Response(JSON.stringify(data));
    } 
    // Manually update the current cached graph list
    else if (request.method === 'POST' && url.pathname === GRAPH_API_PATH) {
      // Check if the request is authorized
      if(!this.env.ADMIN_TOKEN || request.headers.get('Authorization') !== this.env.ADMIN_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }

      const data = await request.json();
      await this.storage.put(DO_CACHE_KEY, data);
      return new Response("Manual Update Success", { status: 200 });
    }

    return new Response("Not found", { status: 404 });
  }

  async alarm(): Promise<void> {
    if (this.env.ENABLE_GRAPH_REFRESH) {
      this.storage.setAlarm(Date.now() + UPDATE_TIME_GRAPH);
    }

    console.log('Alarm Called, fetching latest graph data...');

    const startTime = new Date();
    const graphData = await this.getLatestGraphData();
    const endTime = new Date();

    console.log(`Finished Fetching, caching result graph data... (${endTime.getTime() - startTime.getTime()}ms)`);

    if (graphData !== null) {
      await this.storage.put(DO_CACHE_KEY, graphData);
    }
  }

  async getLatestGraphData(): Promise<CurrentGraphPoint[] | null> {
    const tiltifyData = await this.getLatestData();

    if (!tiltifyData || new Date(tiltifyData.date).getMinutes() % UPDATE_TIME_FREQ !== 0) {
      return null;
    }

    const date = new Date(tiltifyData.date);
    const startDate = new Date(tiltifyData.event.start);
    const endDate = new Date(tiltifyData.event.end);

    if (date < startDate || date > endDate) {
      return null;
    }

    let graphData: CurrentGraphPoint[] = [];
    try {
      graphData = (await this.storage.get(DO_CACHE_KEY)) || [];
    } catch (e) { }

    if (graphData.length === 0) {
      graphData = await this.defaultObject(tiltifyData);
    }

    const pounds = roundAmount(tiltifyData.raised.yogscast + tiltifyData.raised.fundraisers);
    graphData.push({
      "date": date.getTime(),
      "p": pounds,
      "d": roundAmount(pounds * tiltifyData.avgConversionRate),
    });

    return graphData;
  }

  async defaultObject(data?: ApiResponse): Promise<CurrentGraphPoint[]> {
    if (!data) {
      data = await this.getLatestData();
    }

    if (!data) {
      return [];
    }

    return [{
      "date": new Date(data.event.start).getTime(),
      "p": 0,
      "d": 0
    }];
  }

  async getLatestData(): Promise<ApiResponse> {
    const id = this.env.TILTIFY_DATA.idFromName(CACHE_NAME);
    const obj = this.env.TILTIFY_DATA.get(id);
    const resp = await obj.fetch("http://127.0.0.1" + TILTIFY_API_PATH);
    return await resp.json();
  }
}

export default {};