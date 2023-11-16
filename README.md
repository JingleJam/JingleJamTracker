# Jingle Jam Tracker # 
The API and web UI powering the [Jingle Jam Tracker](https://www.jinglejam.co.uk/tracker).

## API Endpoints

### **/api/tiltify**
- Contains the current years Jingle Jam donation data
- Includes the following data
    - Event Information
    - Amount Raised
    - Collection Count
    - Historical Data
    - List of Causes
    - List of Campaigns
- Updates ever 10 seconds

### **/api/graph/current**
- Contains the current years Jingle Jam amount raised data
- Returns a list of amount raised at given timestamps

### **/api/graph/previous**
- Contains the previous years Jingle Jam amount raised data
- Data is from 2016 to 2022
- Returns a list of amount raised at given timestamps and years


## Architecture

### API
The Jingle Jam Tracker API is powered by Cloudflare Workers. For real-time data, the worker aggregates Tiltify API responses into a single response and stores it in a Cloudflare Durable Object for low latency, global access. Static data (cause information, historical records, etc.) is fetched from Cloudflare Worker KVs.

Cloudflare Pages Functions handles the API endpoints above by fetching these Durable Objects and KVs.

### Web UI
The Jingle Jam Tracker UI is powered by Cloudflare Pages. The front end runs using simple JQuery, using [Fomantic UI](https://fomantic-ui.com/) as the UI library and [Chart.js](https://www.chartjs.org/) for the graph.


## Development
The whole system is powered using 2 services, a Cloudflare Workers API service and Cloudflare Pages web service.

1. Install and Configure [Wrangler](https://developers.cloudflare.com/workers/wrangler/)
    - If you're using Visual Studio Code, also install the extension [F5 Anything](https://marketplace.visualstudio.com/items?itemName=discretegames.f5anything) to help run launch configurations

2. Run the "Add Local KV's" configuration to setup the static Cloudflare KV values
    - If you're not using Visual Studio Code, run the commands in the launch.json manually to setup the KV bindings

3. Run both the Web and API services 
    - If you're not using Visual Studio Code, run the commands in the launch.json manually to run both applications

4. Access the Web UI by going to **http://127.0.0.1:8788/home**
5. Access the API by going to **http://127.0.0.1:8788/api/tiltify**