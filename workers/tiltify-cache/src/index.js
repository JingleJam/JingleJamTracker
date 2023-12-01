
import { getLatestData } from "./api";
import { roundAmount } from "./utils";

const UPDATE_TIME_GRAPH = 60 * 1000; //Refresh cache every 60 seconds
const UPDATE_TIME_FREQ = 10; //Refresh graph every 10 minutes

const DO_CACHE_KEY = 'tiltify-cache'; //Key to store the cache
const CACHE_NAME = 'tiltify-cache-2023'; //Cache Object Name

const TILTIFY_API_PATH = '/api/tiltify'; //API Path for the Tiltify Cache
const GRAPH_API_PATH = '/api/graph/current'; //API Path for the Graph Data

// Tiltify Data Object
export class TiltifyData {

	constructor(state, env) {
		this.state = state;
		this.storage = state.storage;
		this.env = env;
	}

	// Handle HTTP requests from clients.
	async fetch(request) {
		// Apply requested action.
		let url = new URL(request.url);

		console.log('Called ' + url.pathname);

		if (request.method === 'GET' && url.pathname === TILTIFY_API_PATH) {
			//Get the current cached value
			let data = await this.state.storage.get(DO_CACHE_KEY);

			//Start the alarm if it is currently not started
			let currentAlarm = await this.storage.getAlarm();
			if (currentAlarm == null && this.env.ENABLE_REFRESH) {
				this.storage.setAlarm(Date.now() + (this.env.REFRESH_TIME * 1000));
			}

			//If the cached value is null, fetch the latest data and save it to the cache
			if (!data) {
				data = await getLatestData(this.env);

				if (this.env.ENABLE_REFRESH)
					await this.state.storage.put(DO_CACHE_KEY, data);
			}

			return new Response(JSON.stringify(data));
		}

		//Invalid API Endpoint
		return new Response("Not found", { status: 404 });
	}

	async alarm() {
		//Enable the alarm again
		if (this.env.ENABLE_REFRESH)
			this.storage.setAlarm(Date.now() + (this.env.REFRESH_TIME * 1000));

		console.log('Alarm Called, fetching latest Tiltify data...');

		//Get the current stored data
		let data = await this.state.storage.get(DO_CACHE_KEY);

		//Fetch the latest Tiltify data and cache it
		let startTime = new Date();
		let newData = await getLatestData(this.env);
		let endTime = new Date();

		let dataToStore = newData;

		let isLive = newData.event.start <= Date.now() && newData.event.end >= Date.now();

		//If previous cached data exists, check if the new data has a higher values. If not, keep the old data and update the date
		if (data && isLive && (data.raised.yogscast > newData.raised.yogscast || data.raised.fundraisers > newData.raised.fundraisers)) {
			data.date = newData.date;
			dataToStore = data;
		}

		console.log(`Finished Fetching, caching result Tiltify data... (${endTime - startTime}ms)`);

		await this.state.storage.put(DO_CACHE_KEY, dataToStore);
	}
}

// Graph Data Object
export class GraphData {

	constructor(state, env) {
		this.state = state;
		this.storage = state.storage;
		this.env = env;
	}

	// Handle HTTP requests from clients.
	async fetch(request) {
		// Apply requested action.
		let url = new URL(request.url);

		console.log('Called ' + url.pathname);

		//Get the current graph data
		if (request.method === 'GET' && url.pathname === GRAPH_API_PATH) {
			//Get the current cached value
			let data = await this.state.storage.get(DO_CACHE_KEY) || null;

			//If the data has not been cached yet, get the latest data from the Tiltify cache and create a default object of $0 for the start of the event
			if (!data) {
				//Get the default object
				data = await this.defaultObject();

				await this.state.storage.put(DO_CACHE_KEY, data);
			}

			//Start the alarm if it is currently not started
			let currentAlarm = await this.storage.getAlarm();
			if (currentAlarm == null && this.env.ENABLE_REFRESH) {
				this.storage.setAlarm(Date.now() + UPDATE_TIME_GRAPH);
			}

			return new Response(JSON.stringify(data));
		}
		//Clear the current graph data
		else if (request.method === 'POST' && url.pathname === GRAPH_API_PATH) {
			//Get the default object
			let data = await request.json();

			await this.state.storage.put(DO_CACHE_KEY, data);

			return new Response("Manual Update Success", { status: 200 });
		}

		//Invalid API Endpoint
		return new Response("Not found", { status: 404 });
	}

	async alarm() {
		//Enable the alarm again
		if (this.env.ENABLE_REFRESH)
			this.storage.setAlarm(Date.now() + UPDATE_TIME_GRAPH);

		console.log('Alarm Called, fetching latest graph data...');

		//Get the cached graph data and update it
		let startTime = new Date();
		let graphData = await this.getLatestGraphData();
		let endTime = new Date();

		console.log(`Finished Fetching, caching result graph data... (${endTime - startTime}ms)`);

		//If the graph data was updated, update the cache
		if (graphData !== null)
			await this.state.storage.put(DO_CACHE_KEY, graphData);
	}

	async getLatestGraphData() {
		//Get the latest data from the Tiltify cache
		let tiltifyData = await this.getLatestData();

		//If UPDATE_TIME_FREQ amount of minutes has not passed, don't add the point
		if (!tiltifyData || new Date(tiltifyData.date).getMinutes() % UPDATE_TIME_FREQ !== 0)
			return null;

		let date = new Date(tiltifyData.date);
		let startDate = new Date(tiltifyData.event.start);
		let endDate = new Date(tiltifyData.event.end);

		//If the date is not between the start and end date of the event, return null
		if (date < startDate || date > endDate)
			return null;

		//Get the graph data currently stored
		let graphData = [];
		try {
			graphData = await this.state.storage.get(DO_CACHE_KEY);
		}
		catch (e) { }

		//If the graph data is empty, create a default object with a start value of $0
		if (graphData.length === 0)
			graphData = await this.defaultObject(tiltifyData);

		//Add the latest data to the object
		let pounds = roundAmount(tiltifyData.raised.yogscast + tiltifyData.raised.fundraisers);
		graphData.push({
			"date": date.getTime(),
			"p": pounds,
			"d": roundAmount(pounds * tiltifyData.avgConversionRate)
		})

		return graphData;
	}

	//Get the default cached object
	async defaultObject(data) {
		//If data is not specified, set it to the latest data from the Tiltify cache
		if (!data)
			data = await this.getLatestData();

		//If the tiltify data is null, return a default object
		if (!data)
			return [];

		return [{
			"date": new Date(data.event.start).getTime(),
			"p": 0,
			"d": 0
		}]
	}

	//Get the latest data from the Tiltify cache
	async getLatestData() {
		let id = this.env.TILTIFY_DATA.idFromName(CACHE_NAME);
		let obj = this.env.TILTIFY_DATA.get(id);
		let resp = await obj.fetch("http://127.0.0.1" + TILTIFY_API_PATH);
		let tiltifyData = await resp.json();

		return tiltifyData;
	}
}

export default {}