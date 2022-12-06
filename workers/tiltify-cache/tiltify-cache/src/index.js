
import {
	getTiltifyData
  } from "./tiltify";

export default {
	async fetch(request, env) {
	  return await handleRequest(request, env);
	}
  }
  
  async function handleRequest(request, env) {
	let id = env.TILTIFY_DATA.idFromName("tiltify-2022-cache");
	let obj = env.TILTIFY_DATA.get(id);
	let resp = await obj.fetch(request.url);
	let response = await resp.text();
  
	return new Response(response,  {
		headers: {
		  "content-type": "application/json;charset=UTF-8",
		  'Access-Control-Allow-Origin': '*',
		  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
		  'Access-Control-Max-Age': '86400',
		  'Allow': 'GET, HEAD, OPTIONS',
		  'Vary': 'Origin'
		}
	  });
  }
  

	const TIME = 15 * 1000;

  // Durable Object
  
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

	  if(url.pathname === '/'){

		let cachedValue = await this.state.storage.get("cached-value");

		let currentAlarm = await this.storage.getAlarm();
		if (currentAlarm == null) {
			this.storage.setAlarm(Date.now() + TIME);
		}
  
		let data = {};
		if(cachedValue){
			console.log('Retrieved from cache')
		  	data = JSON.parse(cachedValue);
		}
		else{
			console.log('Fetch live')
			
			data = await getTiltifyData(this.env);
		}

		let strData = JSON.stringify(data);
  
		await this.state.storage.put("cached-value", strData);
	
		return new Response(strData);
	  }
	  
	  return new Response("Not found", { status: 404 });
	}

	async alarm() {
		this.storage.setAlarm(Date.now() + TIME);

		console.log('Alarm Called, fetching latest...');

		let data = await getTiltifyData(this.env);
		let strData = JSON.stringify(data);

		console.log('Finished fetching, caching...');
  
		await this.state.storage.put("cached-value", strData);
	}
  }
