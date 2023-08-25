
import {
	getTiltifyData
} from "./tiltify";

const UPDATE_TIME = 10 * 1000; //Refresh cache every 15 seconds
const DO_CACHE_KEY = 'cached-value'; //Key to store the cache

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

		if (url.pathname === '/api/tiltify') {
			//Get the current cached value
			let cachedValue = await this.state.storage.get(DO_CACHE_KEY);

			//Start the alarm if it is currently not started
			let currentAlarm = await this.storage.getAlarm();
			if (currentAlarm == null && this.env.ENABLE_REFRESH) {
				this.storage.setAlarm(Date.now() + UPDATE_TIME);
			}

			let strData = '';

			if (cachedValue) {
				console.log('Retrieved from cache')
				strData = JSON.stringify(cachedValue);
			}
			else {
				console.log('Fetched live')

				data = await getTiltifyData(this.env);
				strData = JSON.stringify(data);

				if (ENABLE_REFRESH)
					await this.state.storage.put(DO_CACHE_KEY, strData);
			}

			return new Response(strData);
		}

		return new Response("Not found", { status: 404 });
	}

	async alarm() {
		if (this.env.ENABLE_REFRESH)
			this.storage.setAlarm(Date.now() + UPDATE_TIME);

		console.log('Alarm Called, fetching latest...');

		let startTime = new Date();
		let data = await getTiltifyData(this.env);
		let endTime = new Date();

		console.log(`Finished Fetching, caching result... (${endTime - startTime}ms)`);

		await this.state.storage.put(DO_CACHE_KEY, data);
	}
}

export default {}