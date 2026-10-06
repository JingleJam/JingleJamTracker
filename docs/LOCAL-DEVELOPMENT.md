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
| Home | http://127.0.0.1:8788/home |
| Main tracker | http://127.0.0.1:8788/tracker |
| Whole-event tracker | http://127.0.0.1:8788/jingle-jam |
| Cause tracker | http://127.0.0.1:8788/causes/war-child (one per cause in [kv/causes.json](../kv/causes.json)) |
| Campaign and team event tracker | http://127.0.0.1:8788/campaigns/{id} (any `id` from `/api/v1/campaigns`, including team events from `/api/v1/campaigns?type=team_event`) |
| TV view | http://127.0.0.1:8788/tv?type=cause&id=war-child |
| API | http://127.0.0.1:8788/api/v1/event |

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
- **Live data.** On the first request to `/api/v1/event` with an empty cache, the Worker fetches the current data from Tiltify. The timed refresh loops are **off** locally, so the data stays as it is until you restart or reset.
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
curl -s http://127.0.0.1:8788/api/v1/event > summary.json
node -e "
  const fs = require('fs'), s = JSON.parse(fs.readFileSync('summary.json'));
  const now = Date.now();
  s.meta.updatedAt = new Date(now).toISOString();
  s.meta.event.startsAt = new Date(now - 6 * 864e5).toISOString();
  s.meta.event.endsAt = new Date(now + 8 * 864e5).toISOString();
  fs.writeFileSync('summary-live.json', JSON.stringify(s));
"

curl -X POST http://127.0.0.1:8788/api/v1/event \
  -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
  --data-binary @summary-live.json
```

`/api/v1/campaigns`, `/api/v1/campaigns/{id}` and `/api/v1/causes/{cause}` use the full campaign list in memory, which this doesn't replace. To see campaigns, the Worker needs a list from Tiltify or the `campaigns-{YEAR}` KV backup. POST an array of points to `/api/v1/timeline` to fill the main tracker's graph. POST the saved `summary.json` back, or run `npm run reset`, to undo.

[Demo mode](#demo-mode) is usually quicker. It fills every page with generated data, campaigns included.

### Demo mode

Set `DEMO_MODE` in `workers/tiltify-cache/.dev.vars` to serve generated data instead of Tiltify's, then restart `npm run dev`:

```ini
DEMO_MODE="running"
```

| Mode | On the first request |
|---|---|
| `starting` | The event starts in 30 seconds. Until then there are no campaigns, team events or donations, so you can watch the countdown end and everything appear. |
| `running` | The event is 3 days in, with the totals, campaigns and graph already filled. |
| `ending` | The event ends in 30 seconds, with almost everything raised, so you can watch it finish. |

The demo uses the causes and history from KV, with generated campaigns, team events and their supporting campaigns, teams without a team event, live streams, donation matches, rewards, top donors, latest donations and social links. It also includes campaigns for checking the extremes:
- long and unicode names, and text that needs escaping
- missing and broken avatars
- no goal, far over goal, and nothing raised
- streams that are always live or never live
- leaderboards turned off and sold-out rewards

The last cause gets no campaigns of its own, so it only has its share of the money given to every cause.

- **Timing.** The event lasts as long as the real one, and money comes in at about the real event's pace, so the totals move on every refresh. The data refreshes every `LIVE_REFRESH_TIME` seconds, even with `ENABLE_REFRESH` off.
- **Campaigns.** There are no campaigns or team events before the start. About 140 go up as the event starts, including the team events and the edge cases, and the rest during the event, more of them early on, until there are about 350. Each raises its money between being published and the end. Goals are 10–50% of what a campaign raises by the end, so most pass their goal around the middle of the event.
- **Live streams.** Streams last half an hour to a few hours. How many are live follows the time of day, counted from a 17:00 start like the real event: most in the evening, fewest in the morning, and extra on the opening night and the final day.
- **Restarting the demo.** The first request stores the demo's start time in KV (`demo-clock`), so the totals, the graph and every page agree, and file changes don't restart it. `npm run seed` clears it, which also happens on every `npm run dev`. Changing the mode also starts again.
- **Real data is left alone.** The demo never calls Tiltify, and it never saves its data to Durable Object storage, to the `campaigns-{YEAR}` backup, or to the graph. Turning the demo off goes straight back to the stored Tiltify data.

A `DEMO_MODE` that isn't one of the modes fails every request instead of calling Tiltify. Leave it empty in `wrangler.toml`, so the deployed Workers never serve demo data.

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
| [summary.json](../kv/summary.json) | `summary` | Final totals for every previous year (the `history` field of `/api/v1/event`) |
| [trends-previous.json](../kv/trends-previous.json) | `trends-previous` | Previous years' graph points (`/api/v1/timeline/history`) |

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

The `Authorization` header must be the token value, on its own or as `Bearer <token>`, and `ADMIN_TOKEN` must be set in `.dev.vars`. Restart `npm run dev` after editing `.dev.vars`.

</details>

## Before opening a pull request

- Run `npm run typecheck` and `npm test`. CI runs the same checks, plus dry-run builds of the Functions and both Worker environments.
- Open pull requests against `develop`. Merging to `develop` deploys to the development environment, and `master` is production.
- If you change an endpoint or a response field, update [API.md](API.md).
