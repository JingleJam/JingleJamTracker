
import {
	getTiltifyData
  } from "./tiltify";

export default {
	async fetch(request, env) {
	  return await handleRequest(request, env);
	}
  }

  const UPDATE_TIME = 15 * 1000; //Refresh cache every 15 seconds
  const ENABLE_REFRESH = false;

  const finalResults = {
	"year": 2022,
	"name": "The Jingle Jam 2022",
	"date": "2022-12-15T01:28:27.399Z",
	"poundsToDollars": 1.21885574,
	"raised": {
	  "dollars": 3332197.58,
	  "pounds": 2733873.65
	},
	"fundraisers": {
	  "dollars": 871334.07,
	  "pounds": 714878.75
	},
	"total": {
	  "dollars": 4203531.65,
	  "pounds": 3448752.40
	},
	"bundles": {
	  "sold": 79125,
	  "remaining": 0,
	  "available": 100000,
	  "allocated": 99999
	},
	"donations": {
	  "count": 86589
	},
	"average": {
	  "dollars": 48.55,
	  "pounds": 39.83
	},
	"years": [
	  {
		"year": 2011,
		"total": {
		  "dollars": 102514.55,
		  "pounds": 65655.44
		},
		"donations": 3615
	  },
	  {
		"year": 2012,
		"total": {
		  "dollars": 391145.7,
		  "pounds": 242557.27
		},
		"donations": 13389
	  },
	  {
		"year": 2013,
		"total": {
		  "dollars": 1159813.34,
		  "pounds": 708587.96
		},
		"donations": 47885
	  },
	  {
		"year": 2014,
		"total": {
		  "dollars": 1104882.09,
		  "pounds": 702925.99
		},
		"donations": 40277
	  },
	  {
		"year": 2015,
		"total": {
		  "dollars": 1052881.48,
		  "pounds": 691616.79
		},
		"donations": 40201
	  },
	  {
		"year": 2016,
		"total": {
		  "dollars": 2578201.7,
		  "pounds": 2049000.02
		},
		"donations": 86589
	  },
	  {
		"year": 2017,
		"total": {
		  "dollars": 5245772,
		  "pounds": 3894251.3
		},
		"donations": 148853
	  },
	  {
		"year": 2018,
		"total": {
		  "dollars": 3307959.36,
		  "pounds": 2594961.8
		},
		"donations": 88139
	  },
	  {
		"year": 2019,
		"total": {
		  "dollars": 2739251.08,
		  "pounds": 2111250.38
		},
		"donations": 81719
	  },
	  {
		"year": 2020,
		"total": {
		  "dollars": 2827226.07,
		  "pounds": 2120590
		},
		"donations": 73395
	  },
	  {
		"year": 2021,
		"total": {
		  "dollars": 4435933.89,
		  "pounds": 3345156
		},
		"donations": 84974
	  }
	],
	"entire": {
	  "amount": {
		"dollars": 29149112.91,
		"pounds": 21975305.35
	  },
	  "donations": 795625
	},
	"campaigns": [
	  {
		"id": 566,
		"slug": 566,
		"name": "All Charities",
		"currency": "GBP",
		"raised": {
			"dollars": 3332197.58,
			"pounds": 2733873.65
		},
		"fundraisers": {
		  "dollars": 484195.02,
		  "pounds": 397253.85
		},
		"total": {
		  "dollars": 3816349.14,
		  "pounds": 3131092.5
		}
	  },
	  {
		"id": 576,
		"slug": 576,
		"name": "British Red Cross",
		"currency": "GBP",
		"raised": {
		  "dollars": 0,
		  "pounds": 0
		},
		"fundraisers": {
		  "dollars": 50136.97,
		  "pounds": 41134.47
		},
		"total": {
		  "dollars": 50136.97,
		  "pounds": 41134.47
		}
	  },
	  {
		"id": 575,
		"slug": 575,
		"name": "Campaign Against Living Miserably (CALM)",
		"currency": "GBP",
		"raised": {
		  "dollars": 0,
		  "pounds": 0
		},
		"fundraisers": {
		  "dollars": 33613.95,
		  "pounds": 27578.29
		},
		"total": {
		  "dollars": 33613.95,
		  "pounds": 27578.29
		}
	  },
	  {
		"id": 564,
		"slug": 564,
		"name": "Dogs For Autism",
		"currency": "GBP",
		"raised": {
		  "dollars": 0,
		  "pounds": 0
		},
		"fundraisers": {
		  "dollars": 16980.7,
		  "pounds": 13931.68
		},
		"total": {
		  "dollars": 16980.7,
		  "pounds": 13931.68
		}
	  },
	  {
		"id": 565,
		"slug": 565,
		"name": "The Grand Appeal",
		"currency": "GBP",
		"raised": {
		  "dollars": 0,
		  "pounds": 0
		},
		"fundraisers": {
		  "dollars": 15838.51,
		  "pounds": 12994.58
		},
		"total": {
		  "dollars": 15838.51,
		  "pounds": 12994.58
		}
	  },
	  {
		"id": 567,
		"slug": 567,
		"name": "Huntington's Disease Association",
		"currency": "GBP",
		"raised": {
		  "dollars": 0,
		  "pounds": 0
		},
		"fundraisers": {
		  "dollars": 7925.66,
		  "pounds": 6502.54
		},
		"total": {
		  "dollars": 7925.66,
		  "pounds": 6502.54
		}
	  },
	  {
		"id": 568,
		"slug": 568,
		"name": "Kidscape",
		"currency": "GBP",
		"raised": {
		  "dollars": 0,
		  "pounds": 0
		},
		"fundraisers": {
		  "dollars": 7778.95,
		  "pounds": 6382.18
		},
		"total": {
		  "dollars": 7778.95,
		  "pounds": 6382.18
		}
	  },
	  {
		"id": 569,
		"slug": 569,
		"name": "Mermaids",
		"currency": "GBP",
		"raised": {
		  "dollars": 0,
		  "pounds": 0
		},
		"fundraisers": {
		  "dollars": 55431.4,
		  "pounds": 45478.24
		},
		"total": {
		  "dollars": 55431.4,
		  "pounds": 45478.24
		}
	  },
	  {
		"id": 570,
		"slug": 570,
		"name": "Movember",
		"currency": "GBP",
		"raised": {
		  "dollars": 0,
		  "pounds": 0
		},
		"fundraisers": {
		  "dollars": 38193.97,
		  "pounds": 31335.93
		},
		"total": {
		  "dollars": 38193.97,
		  "pounds": 31335.93
		}
	  },
	  {
		"id": 571,
		"slug": 571,
		"name": "RESET Mental Health",
		"currency": "GBP",
		"raised": {
		  "dollars": 0,
		  "pounds": 0
		},
		"fundraisers": {
		  "dollars": 12745.69,
		  "pounds": 10457.1
		},
		"total": {
		  "dollars": 12745.69,
		  "pounds": 10457.1
		}
	  },
	  {
		"id": 572,
		"slug": 572,
		"name": "SpecialEffect",
		"currency": "GBP",
		"raised": {
		  "dollars": 0,
		  "pounds": 0
		},
		"fundraisers": {
		  "dollars": 19725.92,
		  "pounds": 16183.97
		},
		"total": {
		  "dollars": 19725.92,
		  "pounds": 16183.97
		}
	  },
	  {
		"id": 573,
		"slug": 573,
		"name": "Special Olympics Great Britain",
		"currency": "GBP",
		"raised": {
		  "dollars": 0,
		  "pounds": 0
		},
		"fundraisers": {
		  "dollars": 22120.81,
		  "pounds": 18148.84
		},
		"total": {
		  "dollars": 22120.81,
		  "pounds": 18148.84
		}
	  },
	  {
		"id": 574,
		"slug": 574,
		"name": "Whale and Dolphin Conservation",
		"currency": "GBP",
		"raised": {
		  "dollars": 0,
		  "pounds": 0
		},
		"fundraisers": {
		  "dollars": 110341.86,
		  "pounds": 90529.08
		},
		"total": {
		  "dollars": 110341.86,
		  "pounds": 90529.08
		}
	  }
	]
  };
  
  async function handleRequest(request, env) {
	let response = '';
	if(finalResults){
		response = JSON.stringify(finalResults);
	}
	else{
		let id = env.TILTIFY_DATA.idFromName("tiltify-2022-cache");
		let obj = env.TILTIFY_DATA.get(id);
		let resp = await obj.fetch(request.url);
		response = await resp.text();
	}
  
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

	  if(url.pathname === '/'){

		let cachedValue = null;
		
		if(ENABLE_REFRESH)
			cachedValue = await this.state.storage.get("cached-value");

		let currentAlarm = await this.storage.getAlarm();
		if (currentAlarm == null && ENABLE_REFRESH) {
			this.storage.setAlarm(Date.now() + UPDATE_TIME);
		}
  
		let data = {};
		let strData = '';

		if(cachedValue){
			console.log('Retrieved from cache')
		  	data = JSON.parse(cachedValue);
			strData = JSON.stringify(data);
		}
		else{
			console.log('Fetched live')
			
			data = await getTiltifyData(this.env);
			strData = JSON.stringify(data);
  
			if(ENABLE_REFRESH)
				await this.state.storage.put("cached-value", strData);
		}
	
		return new Response(strData);
	  }
	  
	  return new Response("Not found", { status: 404 });
	}

	async alarm() {
		if(ENABLE_REFRESH)
			this.storage.setAlarm(Date.now() + UPDATE_TIME);

		console.log('Alarm Called, fetching latest...');

		let data = await getTiltifyData(this.env);
		let strData = JSON.stringify(data);

		console.log('Finished Fetching, caching result...');
  
		await this.state.storage.put("cached-value", strData);
	}
  }
