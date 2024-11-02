# Jingle Jam Tracker # 
The API and Web UI powering the official [Jingle Jam Tracker](https://www.jinglejam.co.uk/tracker).

## API Endpoints

### **/api/tiltify**
- Jingle Jam donation data for the current year
- Includes the following data
    - Event Information
    - Amount Raised
    - Collection Count
    - Historical Data
    - List of Causes
    - List of top 100 Campaigns
- Refreshes every 10 seconds

### **/api/graph/current**
- The total amount donated over time for the current years Jingle Jam
- Refreshes every 10 minutes
- Used for drawing the current years data on the graph

### **/api/graph/previous**
- The total amount donated over time for every Jingle Jam going back to 2016
- Used for drawing the previous years data on the graph


## Services

### Caching Service
The Caching Service aggregates Jingle Jam data across multiple services into a single endpoint, allowing for real time global access. Powered by Cloudflare Workers, the worker aggregates Tiltify and Yogscast API responses into a single response, which is then stored in a Cloudflare Durable Object. A Durable Object alarm is triggered every 10 seconds to refresh the data for real-time stats. Static data (cause information, historical records, etc.) is fetched from Cloudflare Worker KVs.

This service acts only as a background job to update the state of the Durable Object. Fetching the content from the Durable Object requires the API, which hooks in directly to the Caching Service's Durable Object.

### API & Web UI
The Jingle Jam Tracker API & Web UI provides API access to the caching service and hosts the web content for the Jingle Jam Tracker. It is powered by Cloudflare Pages for the Web UI & Cloudflare Functions for the API. The front end uses JQuery, leveraging [Fomantic UI](https://fomantic-ui.com/) for the UI components and [Chart.js](https://www.chartjs.org/) for the graph.

The API integrates directly into the caching service to serve the real time content, as well as Cloudflare KV for serving static content (specifically, the **/api/graph/previous** endpoint).


## Development
The Jingle Jam Tracker runs using 2 services, the Caching Service (using Cloudflare Workers) and the Web & API service (using Cloudflare Pages).

1. Install and Configure [Wrangler](https://developers.cloudflare.com/workers/wrangler/)
    - If you're using Visual Studio Code, also install the extension [F5 Anything](https://marketplace.visualstudio.com/items?itemName=discretegames.f5anything) to help run the launch configurations
`
2. Run the `Add Local KV's` configuration to setup the static Cloudflare KV values (causes, historic data, etc.)
    - If you're not using Visual Studio Code, run the commands in the `launch.json` manually to setup the KV bindings

3. Run both the `Debug Caching Service` first, then the `Run Website & API`
    - If you're not using Visual Studio Code, run the commands in the `launch.json` manually to run both applications

4. Access the Tracker Web UI by going to **http://127.0.0.1:8788/tracker**
5. Access the API by going to **http://127.0.0.1:8788/api/tiltify**