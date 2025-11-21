# Jingle Jam Tracker

The API and Web UI powering the official [Jingle Jam Tracker](https://www.jinglejam.co.uk/tracker). 

**API Endpoints:**
- **Production:** `https://dashboard.jinglejam.co.uk/`
- **Development:** `https://develop.jingle-jam-tracker.pages.dev/`
- **Local:** `http://127.0.0.1:8788/`

> **Note:** The `Development` API includes previous years' data for testing purposes.

## Table of Contents

- [API Documentation](#api-documentation)
- [Usage Guidelines](#usage-guidelines)
- [Architecture](#architecture)
- [Development](#development)
- [Admin Management](#admin-management)
- [Scripts](#scripts)
- [Project Structure](#project-structure)

## API Documentation

📖 **[API Documentation](./API.md)** - Detailed API specification with request/response formats, examples, and type definitions.

## Usage Guidelines

Our API is free to use, but we kindly ask that you adhere to the following usage guidelines to ensure optimal performance for everyone:

**Rate Limit**: Please limit your requests to 1 request per second across your entire user base.

**Higher Usage Needs**: If you expect many users to access your application, we recommend implementing a caching layer between your application and the API. This will help reduce unnecessary load and costs on our API while improving the performance of your application.

## Architecture

The Jingle Jam Tracker consists of two main services:

### Caching Service (`workers/tiltify-cache`)
The Caching Service aggregates Jingle Jam data available from multiple services into a single data object, allowing for quick fetching. 

**Technology Stack:**
- Powered by Cloudflare Workers
- Uses Cloudflare Durable Objects for real-time data caching
- Uses Cloudflare KV for static data storage

**How it works:**
- Aggregates multiple Tiltify endpoints into a single data object
- Stores aggregated data in a Cloudflare Durable Object
- A Durable Object alarm is triggered every 10 seconds to refresh the data
- Static data (cause information, historical records, etc.) are stored and fetched from Cloudflare Worker KV

This service acts as a background job to update the state of the Durable Object. Fetching the current objects stored in the cache requires the API, which hooks in directly to the Caching Service's Durable Object.

### API & Web UI (Root Project)
The Jingle Jam Tracker API & Web UI provides API access to the caching service and hosts the web content for the Jingle Jam Tracker.

**Technology Stack:**
- Cloudflare Pages for the Web UI
- Cloudflare Functions for the API
- Frontend: jQuery with [Fomantic UI](https://fomantic-ui.com/) for UI components
- Charts: [Chart.js](https://www.chartjs.org/) for graph visualization

**Integration:**
- The API integrates directly into the caching service to serve real-time content
- Cloudflare KV is used for serving static content (specifically, the `/api/graph/previous` endpoint)

## Development

### Prerequisites

1. **Node.js** and **npm** installed
2. **Wrangler CLI** installed and configured
   ```bash
   npm install -g wrangler
   wrangler login
   ```
3. **Visual Studio Code** (optional, but recommended)
   - Install the [F5 Anything](https://marketplace.visualstudio.com/items?itemName=discretegames.f5anything) extension to use the launch configurations

### Setup

1. **Install dependencies**
   ```bash
   # Install root project dependencies
   npm install
   
   # Install caching service dependencies
   cd workers/tiltify-cache
   npm install
   cd ../..
   ```

2. **Setup Local KV Storage**
   
   Populate the local Cloudflare KV with static data (causes, historical data, etc.):
   
   **Using VS Code:**
   - Run the `Add Local KV's` launch configuration from the Debug panel
   
   **Manual setup:**
   ```bash
   # From root directory
   npm run kv-trends-previous:local
   
   # From workers/tiltify-cache directory
   cd workers/tiltify-cache
   npm run kv-causes:local
   npm run kv-summary:local
   ```

3. **Run the Development Environment**
   
   **Using VS Code:**
   - Run the `Debug System` compound configuration to start both services with debugging enabled
   
   **Manual setup:**
   ```bash
   # Terminal 1: Start the caching service
   cd workers/tiltify-cache
   npm run dev
   
   # Terminal 2: Start the API & Web UI
   cd ../..
   npm run dev
   ```

4. **Access the Application**
   - **Web UI**: http://127.0.0.1:8788/tracker
   - **API**: http://127.0.0.1:8788/api/tiltify

## Admin Management

The Jingle Jam Tracker provides admin endpoints for manually managing cached data. These endpoints require authentication via an API token.

### Setup Admin Token

**Local Development:**

Create a `.dev.vars` file in the `workers/tiltify-cache` directory with your admin token:

```bash
cd workers/tiltify-cache
echo 'ADMIN_TOKEN="your-secret-token-here"' > .dev.vars
```

**Production/Development Environments:**

Set the secret using Wrangler:

```bash
cd workers/tiltify-cache
wrangler secret put ADMIN_TOKEN
# Enter your token when prompted
```

### Admin API Endpoints

Both endpoints require the `Authorization` header with your admin token value.

#### **POST /api/tiltify**

Manually set the cached Tiltify donation data. This will overwrite the current cached data.

**Request:**
```bash
curl -X POST http://127.0.0.1:8788/api/tiltify \
  -H "Authorization: your-admin-token" \
  -H "Content-Type: application/json" \
  -d @tiltify-data.json
```

**Response:**
- `200 OK` - "Manual Update Success"
- `401 Unauthorized` - Invalid or missing admin token

**Use Cases:**
- Manually updating donation data for testing
- Restoring data from a backup
- Setting initial data before the automatic refresh starts

#### **POST /api/graph/current**

Manually set or clear the current year's graph data. This will overwrite the current cached graph data.

**Request:**
```bash
# Set graph data
curl -X POST http://127.0.0.1:8788/api/graph/current \
  -H "Authorization: your-admin-token" \
  -H "Content-Type: application/json" \
  -d @graph-data.json

# Clear graph data (send empty array)
curl -X POST http://127.0.0.1:8788/api/graph/current \
  -H "Authorization: your-admin-token" \
  -H "Content-Type: application/json" \
  -d '[]'
```

**Response:**
- `200 OK` - "Manual Update Success"
- `401 Unauthorized` - Invalid or missing admin token

**Use Cases:**
- Clearing graph data at the start of a new year
- Manually setting graph data points
- Resetting corrupted graph data

**Note:** The graph data format should match the structure returned by `GET /api/graph/current` (array of objects with `date`, `p`, `d` fields).

## Scripts

### **migrate-trend-data.py**

A utility script located in `scripts/migrate-trend-data.py` that migrates the current year's graph data into the historical trends data format.

**What it does:**
- Fetches data from the `/api/graph/current` endpoint
- Converts the data format from the API response (with `date`, `p`, `d` fields) to the historical format (with `timestamp`, `year`, `amountPounds`, `amountDollars` fields)
- Appends the converted data to `kv/trends-previous.json`, preserving any existing historical data

**Usage:**
Run this script at the end of each Jingle Jam year to archive the current year's trend data into the historical dataset.

```bash
cd scripts
python migrate-trend-data.py
```

**Requirements:**
- Python 3
- `requests` package (`pip install requests`)

**Note:** Make sure to update the `YEAR` variable in the script before running it.

## Project Structure

```
JingleJamTracker/
├── functions/              # Cloudflare Functions (API endpoints)
│   ├── api/
│   │   ├── graph/         # Graph data endpoints
│   │   ├── handler.ts     # Main API handler
│   │   └── tiltify.ts     # Tiltify data endpoint
│   └── types/             # TypeScript type definitions
├── kv/                    # KV data files (JSON)
│   ├── causes.json
│   ├── summary.json
│   └── trends-previous.json
├── scripts/               # Utility scripts
│   └── migrate-trend-data.py
├── website/              # Frontend files
│   ├── index.html
│   ├── script.js
│   ├── style.css
│   └── ...
├── workers/
│   └── tiltify-cache/    # Caching service worker
│       ├── src/
│       │   ├── api.ts
│       │   ├── do/        # Durable Object implementations
│       │   ├── dependencies/
│       │   └── ...
│       └── package.json
├── package.json          # Root project configuration
└── wrangler.toml        # Cloudflare Pages configuration
```
