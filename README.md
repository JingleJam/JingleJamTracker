# Jingle Jam Tracker # 
The API and Web UI powering the official [Jingle Jam Tracker](https://www.jinglejam.co.uk/tracker). The API endpoints are accessable at `https://dashboard.jinglejam.co.uk/`.

## API Endpoints

### **/api/tiltify**
- Real-time Jingle Jam donation data for the current year
- Includes the following data
    - Event Information
    - Amount Raised
    - Collections Redeemed
    - Historical Data
    - Raised for each Cause
    - List of top 100 Campaigns
- Refreshes every 10 seconds

### **/api/graph/current**
- Tracks the amount raised over time as a list of data points
- Data points are added every 10 minutes
- Used for plotting the current years data on the graph

### **/api/graph/previous**
- Tracked the amount raised over time as a list of data points going back to 2016
- Used for plotting the previous years data on the graph

## Usage
Our API is free to use, but we kindly ask that you adhere to the following usage guidelines to ensure optimal performance for everyone:

**Rate Limit**: Please limit your requests to 1 request per second across your entire user base.<br>
**Higher Usage Needs**: If you expect many users to access your application, we recommend implementing a caching layer between your application and the API. This will help reduce unnecessary load and costs on our API while improving the performance of your application.


## Services

### Caching Service
The Caching Service aggregates Jingle Jam data available from multiple services into a single data object, allowing for quick fetching. Powered by Cloudflare Workers, the worker aggregates multiple Tiltify endpoints into a single data object, which is then stored in a Cloudflare Durable Object. A Durable Object alarm is triggered every 10 seconds to refresh the data. Static data, such as cause information, historical records, and more, are stored and fetched from Cloudflare Worker KVs.

This service acts as a background job to update the state of the Durable Object. Fetching the current objects stored in the cache requires the API, which hooks in directly to the Caching Service's Durable Object.

### API & Web UI
The Jingle Jam Tracker API & Web UI provides API access to the caching service and hosts the web content for the Jingle Jam Tracker. It is powered by Cloudflare Pages for the Web UI & Cloudflare Functions for the API. The front end uses JQuery, leveraging [Fomantic UI](https://fomantic-ui.com/) for the UI components and [Chart.js](https://www.chartjs.org/) for the graph.

The API integrates directly into the caching service to serve the real time content, as well as Cloudflare KV for serving static content (specifically, the **/api/graph/previous** endpoint).


## Development
The Jingle Jam Tracker is dependent on 2 services, the Caching service and the Web & API service.

1. Install and Configure [Wrangler](https://developers.cloudflare.com/workers/wrangler/)
    - If you're using Visual Studio Code, also install the extension [F5 Anything](https://marketplace.visualstudio.com/items?itemName=discretegames.f5anything) to help run the launch configurations to populate the KV's
    
2. Run the `Add Local KV's` configuration to setup the static Cloudflare KV values (causes, historic data, etc.)
    - If you're not using Visual Studio Code, run the commands in the `launch.json` manually to setup the KV bindings

3. Run `Debug System` to run both the Caching server (with a debugger) and the API & Web UI
    - If you're not using Visual Studio Code, run the commands in the `launch.json` manually to run both services

4. Access the Tracker Web UI by going to **http://127.0.0.1:8788/tracker**

5. Access the API by going to **http://127.0.0.1:8788/api/tiltify**
