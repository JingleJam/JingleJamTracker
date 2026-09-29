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
- [Project Structure](#project-structure)

## API Documentation

📖 **[API Documentation](./docs/API.md)** - Detailed API specification with request/response formats, examples, and type definitions.

## Usage Guidelines

Our API is free to use, but we kindly ask that you adhere to the following usage guidelines to ensure optimal performance for everyone:

**Rate Limit**: Please limit your requests to 1 request per second across your entire user base.

**Higher Usage Needs**: If you expect many users to access your application, we recommend implementing a caching layer between your application and the API. This will help reduce unnecessary load and costs on our API while improving the performance of your application.

## Architecture

🏗️ **[Architecture](./docs/ARCHITECTURE.md)** - How data flows from Tiltify to the website, where it is stored, and how fresh it is.

## Development

### Prerequisites

1. **Node.js** 22+ and **npm** (required by Wrangler 4; CI uses Node 24, pinned in `.nvmrc`)
2. **Visual Studio Code** (optional) for the bundled tasks and debug configurations

Wrangler is installed as a project dependency, so no global install is needed. Local development runs entirely against local storage and does not need `wrangler login`; that is only required for deploying or writing to remote KV.

### Quick Start

```bash
npm install                                                      # installs the root project and workers/tiltify-cache (npm workspaces)
cp workers/tiltify-cache/.dev.vars.example workers/tiltify-cache/.dev.vars   # then set ADMIN_TOKEN
npm run dev                                                      # seeds local KV, then starts both services
```

- **Web UI**: http://127.0.0.1:8788/tracker
- **API**: http://127.0.0.1:8788/api/tiltify

`npm run dev` starts the caching service (`[worker]`, port 8787) and the API & Web UI (`[web]`, port 8788) in one terminal. The API reaches the caching service's Durable Objects through Wrangler's local dev registry. Ctrl+C stops both.

### Local Data

Both services share one local state directory, `.wrangler/state` in the repository root, so KV and Durable Object data is visible to both.

- **Static KV data** (`kv/causes.json`, `kv/summary.json`, `kv/trends-previous.json`) is written to local KV by `npm run seed`. This runs automatically before every `npm run dev`, so edits to those files are picked up on the next start.
- **Live Tiltify & graph data** is fetched from Tiltify on the first request to `/api/tiltify` when the cache is empty. Timed refreshes are off locally (`ENABLE_REFRESH` / `ENABLE_GRAPH_REFRESH` in `wrangler.toml`); enable them in `.dev.vars` if you need them.
- **Reset**: `npm run reset` deletes all local state and re-seeds KV.

### npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Clear stale dev registry entries, seed local KV, then run the caching service and API & Web UI together |
| `npm run dev:web` | Run only the API & Web UI (port 8788, inspector 9230) |
| `npm run dev:worker` | Run only the caching service (port 8787, inspector 9229) |
| `npm run seed` | Write `kv/*.json` to local KV |
| `npm run reset` | Delete all local state and re-seed KV |
| `npm run typecheck` | Type check both projects (same check as CI) |

### VS Code

- **Run and Debug > Debug System** starts `npm run dev` as the **Dev** task and attaches the debugger to both the cache service (port 9229) and the API & Web UI (port 9230). The debugger reattaches when Wrangler reloads after a file change. Stopping the debugger leaves the servers running; stop them from the **Dev** terminal.
- **Run and Debug > Debug System (Clean)** does the same, but deletes the `.wrangler` folders first so everything starts from freshly seeded data.
- **Ctrl+Shift+B** runs the **Dev** task on its own.
- **Terminal > Run Task** also has **Reset Local Data**, **Clear Local Data** (deletes both `.wrangler` folders) and **Type Check** (errors appear in the Problems panel).

## Admin Management

The Jingle Jam Tracker provides admin endpoints for manually managing cached data. These endpoints require authentication via an API token.

### Setup Admin Token

**Local Development:**

Copy `workers/tiltify-cache/.dev.vars.example` to `workers/tiltify-cache/.dev.vars` and set `ADMIN_TOKEN`:

```bash
cp workers/tiltify-cache/.dev.vars.example workers/tiltify-cache/.dev.vars
```

**Production/Development Environments:**

Set the secret using Wrangler:

```bash
cd workers/tiltify-cache
npx wrangler secret put ADMIN_TOKEN
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

## Project Structure

```
JingleJamTracker/
├── docs/                  # Documentation (API, architecture)
├── functions/             # Cloudflare Functions (API endpoints)
│   ├── api/
│   │   ├── graph/         # Graph data endpoints
│   │   ├── handler.ts     # Main API handler
│   │   └── tiltify.ts     # Tiltify data endpoint
│   └── types/             # TypeScript type definitions
├── kv/                    # KV data files (JSON)
│   ├── causes.json
│   ├── summary.json
│   └── trends-previous.json
├── scripts/               # Local dev scripts (seed, sample data)
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
│       ├── .dev.vars.example # Local secrets and variable overrides
│       └── package.json
├── package.json          # Root project configuration (npm workspaces, dev scripts)
└── wrangler.toml        # Cloudflare Pages configuration
```
