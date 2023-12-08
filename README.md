# Jingle Jam Tracker # 
The API and Web UI powering the official [Jingle Jam Tracker](https://www.jinglejam.co.uk/tracker).

## API Endpoints

### **/api/tiltify**
- Contains the current years Jingle Jam donation data
- Includes the following data
    - Event Information
    - Amount Raised
    - Collection Count
    - Historical Data
    - List of Causes
    - List of top 100 Campaigns
- Updates ever 10 seconds

### **/api/graph/current**
- Returns a list of the amount raised over the course of the current years Jingle Jam
- Updates every 10 minutes
- Used for drawing the current years data on the graph

### **/api/graph/previous**
- Returns a list of the amount raised over the course of the previous years Jingle Jam
- Data starts from the year 2016
- Used for drawing the previous years data on the graph


## Architecture

### Caching Service
The Jingle Jam Tracker Caching Service is powered by Cloudflare Workers. For real-time data, the worker aggregates Tiltify API responses into a single response and stores it in a Cloudflare Durable Object for low latency, global access. A Durable Object alarm is triggered every 10 seconds to update the data in real-time. Static data (cause information, historical records, etc.) is fetched from Cloudflare Worker KVs.

### API & Web UI
The Jingle Jam Tracker API & Web UI is powered by Cloudflare Pages. The front end runs using simple JQuery, leveraging [Fomantic UI](https://fomantic-ui.com/) as the UI library and [Chart.js](https://www.chartjs.org/) for the graph.

Cloudflare Pages Functions handles the API endpoints above by fetching data either from the Durable Objects or from the KVs.


## Development
The whole system runs using 2 services, a Caching Service (using Cloudflare Workers) and the Web & API service (using Cloudflare Pages).

1. Install and Configure [Wrangler](https://developers.cloudflare.com/workers/wrangler/)
    - If you're using Visual Studio Code, also install the extension [F5 Anything](https://marketplace.visualstudio.com/items?itemName=discretegames.f5anything) to help run launch configurations
`
2. Run the `Add Local KV's` configuration to setup the static Cloudflare KV values
    - If you're not using Visual Studio Code, run the commands in the `launch.json` manually to setup the KV bindings

3. Run both the `Caching Service` first, then the `Web UI & API Service`
    - If you're not using Visual Studio Code, run the commands in the `launch.json` manually to run both applications

4. Access the Web UI by going to **http://127.0.0.1:8788/home**
5. Access the API by going to **http://127.0.0.1:8788/api/tiltify**
