# 🛠️ Local Development

[← Back to README](../README.md) · [API](API.md) · [Web Pages](WEB-PAGES.md) · [Architecture](ARCHITECTURE.md)

Run the whole tracker (website, API and caching Worker) on your machine. Everything runs against local storage, so no Cloudflare account is needed.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org) | **22+** | Required by Wrangler 4. CI uses Node 24, pinned in [`.nvmrc`](../.nvmrc). |
| npm | Comes with Node | |
| [VS Code](https://code.visualstudio.com) | Optional | For the included tasks and debugger configurations |

Wrangler is a project dependency, so there's nothing to install globally. You only need `wrangler login` to deploy or to write to remote KV.

## Quick start

```bash
npm install                                                                  # Root project + workers/tiltify-cache (npm workspaces)
cp workers/tiltify-cache/.dev.vars.example workers/tiltify-cache/.dev.vars   # Then set ADMIN_TOKEN
npm run dev                                                                  # Seeds local KV, then starts both services
```

| Open | URL |
|---|---|
| Main tracker | http://127.0.0.1:8788/tracker |
| Cause tracker | http://127.0.0.1:8788/tracker/war-child (one per cause in [kv/causes.json](../kv/causes.json)) |
| Whole-event tracker | http://127.0.0.1:8788/tracker/jingle-jam |
| TV mode | http://127.0.0.1:8788/tracker/war-child?tv |
| API | http://127.0.0.1:8788/api/summary |

`npm run dev` runs two processes in one terminal, and **Ctrl+C** stops both:

| Process | Prefix | Port | Debugger | What it is |
|---|---|---|---|---|
| Caching Worker | `[worker]` | 8787 | 9229 | `tiltify-cache` with the `TiltifyData` and `GraphData` Durable Objects |
| Website & API | `[web]` | **8788** | 9230 | Cloudflare Pages: `website/` and `functions/` |

The Pages Functions reach the Worker's Durable Objects through Wrangler's local dev registry, so always use port **8788**.

## npm scripts

| Script | Does |
|---|---|
| `npm run dev` | Clears stale dev registry entries, seeds local KV, then runs both services |
| `npm run dev:web` | Runs only the website & API (port 8788, debugger 9230) |
| `npm run dev:worker` | Runs only the caching Worker (port 8787, debugger 9229) |
| `npm run seed` | Writes `kv/*.json` to local KV |
| `npm run reset` | Deletes all local state and re-seeds KV |
| `npm run clean` | Deletes both `.wrangler` folders (local state and build cache) |
| `npm run typecheck` | Type checks both projects, the same check CI runs |
| `npm test` | Runs the unit tests in [workers/tiltify-cache/test/](../workers/tiltify-cache/test/) against a fake Tiltify, no network needed |
| `npm run test:live` | Runs the live tests against the real Tiltify API using the finished 2025 event. Needs network access, not run in CI |

## Local data

Both services share one local state directory, `.wrangler/state` in the repository root, so they see the same KV and Durable Object data.

- **Static data.** `causes`, `summary` and `trends-previous` are copied from [kv/](../kv/) into local KV by `npm run seed`. This runs automatically before every `npm run dev`, so edits to those files take effect on the next start.
- **Live data.** On the first request to `/api/summary` with an empty cache, the Worker fetches the current data from Tiltify. The timed refresh loops are **off** locally, so the data stays as it is until you restart or reset.
- **Reset.** `npm run reset` deletes all local state and re-seeds KV.

### Turning on refresh loops

To poll Tiltify on a timer, as production does during the event, uncomment these lines in `workers/tiltify-cache/.dev.vars`:

```ini
ENABLE_REFRESH="true"
ENABLE_GRAPH_REFRESH="true"
```

> [!WARNING]
> Values in `.dev.vars` are strings, so **any** non-empty value, including `"false"`, turns the setting on. To turn it off, comment the line out.

### Testing with live-looking data

Outside December, Tiltify has nothing to show and the pages display a countdown. To see the pages as they look during the event, use the [admin endpoints](API.md#admin-endpoints) to load a summary whose event has already started:

```bash
TOKEN=change-me   # Your ADMIN_TOKEN from .dev.vars

# Save the current summary, then move the event so it is in progress
curl -s http://127.0.0.1:8788/api/summary > summary.json
node -e "
  const fs = require('fs'), s = JSON.parse(fs.readFileSync('summary.json'));
  const now = Date.now();
  s.date = new Date(now).toISOString();
  s.event.start = new Date(now - 6 * 864e5).toISOString();
  s.event.end = new Date(now + 8 * 864e5).toISOString();
  fs.writeFileSync('summary-live.json', JSON.stringify(s));
"

curl -X POST http://127.0.0.1:8788/api/summary \
  -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  --data-binary @summary-live.json
```

`/api/campaigns` and `/api/causes/{cause}` use the full campaign list in memory, which this doesn't replace. To see campaigns, the Worker needs a list from Tiltify or the `campaigns-{YEAR}` KV backup. POST an array of points to `/api/graph/current` to fill the main tracker's graph. POST the saved `summary.json` back, or run `npm run reset`, to undo.

Setting `ENABLE_DEBUG = true` in the Worker's `wrangler.toml` is a quicker alternative. It generates rising fake totals without calling Tiltify, but no campaigns.

## Admin token

The [admin endpoints](API.md#admin-endpoints) need `ADMIN_TOKEN` to be set, and they refuse every request if it isn't.

| Where | How |
|---|---|
| **Local** | Set `ADMIN_TOKEN` in `workers/tiltify-cache/.dev.vars` (copied from [`.dev.vars.example`](../workers/tiltify-cache/.dev.vars.example); gitignored) |
| **Production** | `cd workers/tiltify-cache && npx wrangler secret put ADMIN_TOKEN` |
| **Development** | `cd workers/tiltify-cache && npx wrangler secret put ADMIN_TOKEN -e development` |

## VS Code

| Command | Does |
|---|---|
| **Run and Debug → Debug System** | Runs `npm run dev` as the **Dev** task and attaches the debugger to both the Worker (9229) and the website & API (9230). It reattaches when Wrangler reloads after a file change. Stopping the debugger leaves the servers running; stop them from the **Dev** terminal. |
| **Run and Debug → Debug System (Clean)** | The same, but deletes the `.wrangler` folders first so everything starts from freshly seeded data |
| **Ctrl+Shift+B** | Runs the **Dev** task on its own |
| **Terminal → Run Task** | **Reset Local Data**, **Clear Local Data**, **Clean Dev** (clear, then Dev) and **Type Check** (errors appear in the Problems panel) |

## Updating KV data

The files in [kv/](../kv/) are uploaded to the environment's KV namespace on every deploy (see [Architecture → Environments and deployment](ARCHITECTURE.md#environments-and-deployment)). To upload one by hand:

```bash
npm run kv-trends-previous:development                           # Root: trends-previous
npm run kv-causes:development --workspace tiltify-cache          # causes
npm run kv-summary:development --workspace tiltify-cache         # summary
```

Swap `development` for `production` to upload to production. These need `wrangler login` and access to the Cloudflare account.

| File | KV key | Contents |
|---|---|---|
| [causes.json](../kv/causes.json) | `causes` | This year's causes: Tiltify region `id`, `name`, `logo`, `borderedLogo`, `description`, `color`, `url`, `donateUrl`, and an optional `slug` and `override` |
| [summary.json](../kv/summary.json) | `summary` | Final totals for every previous year (the `history` field of `/api/summary`) |
| [trends-previous.json](../kv/trends-previous.json) | `trends-previous` | Previous years' graph points (`/api/graph/previous`) |

## Troubleshooting

<details>
<summary><b>API returns "Network connection lost" or can't reach the Durable Objects</b></summary>

The website & API find the Worker through Wrangler's dev registry. If a previous session was force-killed, its stale entry can block the new one for up to 90 seconds. `npm run dev` removes stale entries before starting ([scripts/clean-dev-registry.mjs](../scripts/clean-dev-registry.mjs)). If you start the services separately, start `dev:worker` first, or wait and retry.

</details>

<details>
<summary><b>Changes to kv/*.json don't show up</b></summary>

Local KV is only seeded when `npm run dev` or `npm run seed` runs. Restart `npm run dev`. The Worker also keeps its summary in memory, so if a cause's details still look old, run `npm run reset` and restart.

</details>

<details>
<summary><b>The tracker shows a countdown and £0</b></summary>

That's the normal off-season state: the event is in December. See [Testing with live-looking data](#testing-with-live-looking-data).

</details>

<details>
<summary><b>Admin requests return 401</b></summary>

The `Authorization` header must be the token value exactly, with no `Bearer ` prefix, and `ADMIN_TOKEN` must be set in `.dev.vars`. Restart `npm run dev` after editing `.dev.vars`.

</details>

## Before opening a pull request

- Run `npm run typecheck` and `npm test`. CI runs the same checks, plus dry-run builds of the Functions and both Worker environments.
- Open pull requests against `develop`. Merging to `develop` deploys to the development environment, and `master` is production.
- If you change an endpoint or a response field, update [API.md](API.md).
