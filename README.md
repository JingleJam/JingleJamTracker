<div align="center">

<img src="website/assets/jingle-jam-logo.png" alt="Jingle Jam" width="280">

# Jingle Jam Tracker

**The live fundraising tracker and public API behind the [Jingle Jam](https://www.jinglejam.co.uk/tracker).**

[![CI](https://github.com/JingleJam/JingleJamTracker/actions/workflows/ci.yml/badge.svg)](https://github.com/JingleJam/JingleJamTracker/actions/workflows/ci.yml)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Pages%20%2B%20Workers-F38020?logo=cloudflare&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)

[**API**](docs/API.md) · [**Web Pages**](docs/WEB-PAGES.md) · [**Architecture**](docs/ARCHITECTURE.md) · [**Local Development**](docs/LOCAL-DEVELOPMENT.md)

</div>

<br>

![The main Jingle Jam tracker](docs/images/main-tracker.png)

## What is this?

The Jingle Jam is an annual charity fundraiser, run on [Tiltify](https://tiltify.com) through the first two weeks of December. This repository has two parts:

- **A public JSON API** with the event total, per-cause totals, every fundraising campaign, and a graph of the total over time. Anyone can use it, free, with no API key.
- **The tracker web pages** built on that API: the main tracker embedded on jinglejam.co.uk, a tracker for each cause, and a full-screen TV mode for streams and venues.

## Using the API

The API is open to everyone. It needs no key and no sign-up, and CORS is enabled, so it can be called directly from a browser.

```bash
curl https://dashboard.jinglejam.co.uk/api/tiltify
```

```js
const res = await fetch('https://dashboard.jinglejam.co.uk/api/tiltify');
const data = await res.json();

console.log(`£${data.raised.toLocaleString()} raised from ${data.donations.toLocaleString()} donations`);
```

| Endpoint | Returns |
|---|---|
| [`GET /api/tiltify`](docs/API.md#get-apitiltify) | Event totals, per-cause totals, yearly history and the top 100 campaigns |
| [`GET /api/campaigns`](docs/API.md#get-apicampaigns) | Every campaign, paginated |
| [`GET /api/causes/{cause}`](docs/API.md#get-apicausescause) | One cause's total and its top campaigns |
| [`GET /api/graph/current`](docs/API.md#get-apigraphcurrent) | This year's total over time, one point every 10 minutes |
| [`GET /api/graph/previous`](docs/API.md#get-apigraphprevious) | Previous years' totals over time (2016 onwards) |

**Base URL:** `https://dashboard.jinglejam.co.uk`

📖 See the **[API reference](docs/API.md)** for every field, error and example.

### Usage guidelines

The API is free to use. To keep it fast for everyone, please follow these guidelines:

1. **Make at most 1 request per second**, counted across all of your users combined, not per user.
2. **Don't poll faster than every 10 seconds.** The data only refreshes every 10 seconds during the event (and less often outside it), so faster polling returns the same response. Every response has a `date` field saying when it was last refreshed, so you can schedule your next request for about 15 seconds after that time.
3. **Put a cache in front of the API if you have many users.** If your app, bot or overlay is used by lots of people, fetch from your own server and serve those users from your cache, instead of having every client call the API directly.
4. **Expect a quiet off-season.** Outside December, totals are zero or carry over from the last event, and `event.start` / `event.end` show when the next one begins.

See [Usage guide](docs/API.md#usage-guide) for polling code examples.

## The web pages

| Page | URL |
|---|---|
| Main tracker | [`/tracker`](https://dashboard.jinglejam.co.uk/tracker) |
| Cause tracker | [`/tracker/{cause}`](https://dashboard.jinglejam.co.uk/tracker/calm), e.g. `/tracker/calm` |
| Whole-event tracker | [`/tracker/jingle-jam`](https://dashboard.jinglejam.co.uk/tracker/jingle-jam) |

🖥️ See **[Web Pages](docs/WEB-PAGES.md)** for a tour of each page and its options.

## Documentation

| Document | For |
|---|---|
| 📖 [API](docs/API.md) | Developers using the API: endpoints, fields, errors, usage guide |
| 🖥️ [Web Pages](docs/WEB-PAGES.md) | Everyone: what each page shows, URL options, TV mode |
| 🏗️ [Architecture](docs/ARCHITECTURE.md) | Contributors: how data gets from Tiltify to the page, storage, freshness, deployment |
| 🛠️ [Local Development](docs/LOCAL-DEVELOPMENT.md) | Contributors: setup, scripts, local data, debugging, admin endpoints |
| 🧩 [Tiltify Data Model](docs/TILTIFY.md) | Contributors: how Tiltify stores the event, charities and campaigns |

## Contributing

Quick start (Node.js 22+):

```bash
npm install
cp workers/tiltify-cache/.dev.vars.example workers/tiltify-cache/.dev.vars
npm run dev
```

Then open http://127.0.0.1:8788/tracker. See [Local Development](docs/LOCAL-DEVELOPMENT.md) for everything else.

Work happens on `develop`, which deploys to the [development environment](https://develop.jingle-jam-tracker.pages.dev/tracker). Merging to `master` deploys to production.

<div align="center">
<br>
<sub>Donations go to the causes, not to this project. <a href="https://www.jinglejam.co.uk">jinglejam.co.uk</a></sub>
</div>
