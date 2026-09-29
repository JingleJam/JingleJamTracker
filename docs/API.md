# 📖 API Reference

[← Back to README](../README.md) · [Web Pages](WEB-PAGES.md) · [Architecture](ARCHITECTURE.md) · [Local Development](LOCAL-DEVELOPMENT.md)

The Jingle Jam Tracker API is a free, public, read-only JSON API with live and historical Jingle Jam fundraising data. It needs **no API key**, and **CORS is enabled**, so you can call it from a server, a script, a bot or straight from a web page.

```bash
curl https://dashboard.jinglejam.co.uk/api/tiltify
```

## Contents

- [Base URLs](#base-urls)
- [Usage guidelines](#usage-guidelines)
- [Usage guide](#usage-guide): quick start, polling, recipes
- [Endpoints](#endpoints)
  - [`GET /api/tiltify`](#get-apitiltify): event summary
  - [`GET /api/campaigns`](#get-apicampaigns): every campaign, paginated
  - [`GET /api/causes/{cause}`](#get-apicausescause): a single cause
  - [`GET /api/graph/current`](#get-apigraphcurrent): this year's total over time
  - [`GET /api/graph/previous`](#get-apigraphprevious): previous years' totals over time
- [Types](#types): `Cause`, `Campaign`, `DonationHistory`
- [Errors](#errors)
- [CORS](#cors)
- [Admin endpoints](#admin-endpoints) (maintainers only)

---

## Base URLs

| Environment | Base URL | Use it for |
|---|---|---|
| **Production** | `https://dashboard.jinglejam.co.uk` | Anything real |
| Development | `https://develop.jingle-jam-tracker.pages.dev` | Trying out upcoming changes. It may include test data and can break without notice. |
| Local | `http://127.0.0.1:8788` | Working on this repository ([Local Development](LOCAL-DEVELOPMENT.md)) |

Every endpoint path below is relative to the base URL, e.g. `https://dashboard.jinglejam.co.uk/api/tiltify`.

## Usage guidelines

The API is free for anyone to use. To keep it fast and affordable for everyone, please follow these guidelines:

> [!IMPORTANT]
> **Make at most 1 request per second**, counted across all of your users combined, not per user.

- **Don't poll faster than every 10 seconds.** During the event the data refreshes every 10 seconds (less often outside it), so faster polling returns the same response. See [Polling for live updates](#polling-for-live-updates).
- **Put a cache in front of the API if you have many users.** If your app, website, bot or overlay has lots of users, fetch from your own server and serve those users from your cache, instead of having every client call the API directly.
- **Fetch only what you need.** `/api/tiltify` already includes the top 100 campaigns. Only page through `/api/campaigns` if you need campaigns beyond those.
- **Link back to the Jingle Jam** ([jinglejam.co.uk](https://www.jinglejam.co.uk)) where it makes sense, so people can donate.

---

## Usage guide

### Quick start

<details open>
<summary><b>JavaScript (browser or Node.js 18+)</b></summary>

```js
const res = await fetch('https://dashboard.jinglejam.co.uk/api/tiltify');
const data = await res.json();

console.log(`Jingle Jam ${data.event.year}`);
console.log(`£${data.raised.toLocaleString('en-GB')} raised`);
console.log(`$${Math.round(data.raised * data.dollarConversionRate).toLocaleString('en-US')} raised`);
console.log(`${data.donations.toLocaleString()} donations, ${data.campaigns.count} campaigns`);

for (const cause of data.causes) {
  console.log(`${cause.name}: £${cause.raised.toLocaleString('en-GB')}`);
}
```

</details>

<details>
<summary><b>Python</b></summary>

```python
import requests

data = requests.get("https://dashboard.jinglejam.co.uk/api/tiltify", timeout=10).json()

print(f"Jingle Jam {data['event']['year']}")
print(f"£{data['raised']:,.2f} raised from {data['donations']:,} donations")

for cause in data["causes"]:
    print(f"{cause['name']}: £{cause['raised']:,.2f}")
```

</details>

<details>
<summary><b>curl + jq</b></summary>

```bash
# Total raised
curl -s https://dashboard.jinglejam.co.uk/api/tiltify | jq '.raised'

# Each cause and its total
curl -s https://dashboard.jinglejam.co.uk/api/tiltify | jq -r '.causes[] | "\(.name): £\(.raised)"'

# The top 5 campaigns for War Child
curl -s "https://dashboard.jinglejam.co.uk/api/causes/war-child?limit=5" | jq -r '.campaigns.list[] | "\(.name) (\(.user.name)): £\(.raised)"'
```

</details>

### Polling for live updates

Every response has a `date` field: the time the server last fetched fresh data from Tiltify. During the event that happens every 10 seconds. Tiltify's own totals can also lag by a few seconds.

The simplest correct approach is to poll every **15 seconds**. To stay closer to the live figures, schedule each request about 15 seconds after the previous response's `date`, which is what the official tracker does:

```js
const API = 'https://dashboard.jinglejam.co.uk/api/tiltify';
const REFRESH_MS = 10_000;   // How often the server refreshes
const DELAY_MS = 5_000;      // Allowance for the refresh to complete
const MIN_WAIT_MS = 5_000;   // Never poll more often than this

async function poll() {
  let wait = 15_000;
  try {
    const data = await (await fetch(API)).json();
    render(data);

    // Wait until shortly after the next server refresh is due
    const age = Date.now() - new Date(data.date).getTime();
    wait = Math.max(REFRESH_MS + DELAY_MS - age, MIN_WAIT_MS);
  } catch (err) {
    console.error('Update failed, retrying', err);
  }
  setTimeout(poll, wait);
}

poll();
```

> [!TIP]
> Outside the event window (`event.start` to `event.end`) the totals don't change, so you can stop polling or back off to a few minutes. The official tracker stops polling once the event ends and pauses while the browser tab is hidden.

### Recipes

**Show a countdown before the event starts.** `event.start` and `event.end` are ISO 8601 UTC timestamps. The event normally runs from 1 December 17:00 UTC to 15 December 08:00 UTC.

```js
const { event } = await (await fetch('https://dashboard.jinglejam.co.uk/api/tiltify')).json();
const now = new Date();
const status = now < new Date(event.start) ? 'upcoming'
             : now > new Date(event.end)   ? 'ended'
             : 'live';
```

**Show amounts in dollars.** Amounts are in pounds (GBP). Multiply by `dollarConversionRate` to get US dollars:

```js
const dollars = data.raised * data.dollarConversionRate;
```

**Track a single cause.** Use `/api/causes/{cause}` with the cause's `slug` from `/api/tiltify`, e.g. `war-child`. Use `jingle-jam` to get the same shape of response for the whole event:

```js
const warChild = await (await fetch('https://dashboard.jinglejam.co.uk/api/causes/war-child?limit=10')).json();
console.log(`${warChild.cause.name}: £${warChild.cause.raised}, ${warChild.campaigns.live} live now`);
```

**Find a streamer's campaign.** Page through `/api/campaigns` and match on `user.slug` (or `team.slug`):

```js
async function findCampaigns(userSlug) {
  const results = [];
  for (let offset = 0; ; offset += 100) {
    const page = await (await fetch(`https://dashboard.jinglejam.co.uk/api/campaigns?limit=100&offset=${offset}`)).json();
    results.push(...page.campaigns.filter(c => c.user.slug === userSlug));
    if (offset + page.limit >= page.total) return results;
  }
}
```

> [!NOTE]
> Paging through every campaign makes one request per 100 campaigns, which can be 10 or more requests. Space them out (see the [usage guidelines](#usage-guidelines)) and cache the result rather than repeating it every few seconds.

**Plot this year against previous years.** Combine [`/api/graph/current`](#get-apigraphcurrent) and [`/api/graph/previous`](#get-apigraphprevious). To line the years up, plot each point by time since its own event start, not by calendar date.

---

## Endpoints

All endpoints are `GET` requests that return JSON (`Content-Type: application/json;charset=UTF-8`). All amounts are in **pounds (GBP)** unless the field name says otherwise.

### `GET /api/tiltify`

The main summary of the current event: the total raised, donation and collection counts, a total for each cause, yearly history and the top 100 campaigns.

```http
GET /api/tiltify
```

**Refreshed:** every 10 seconds during the event.

#### Response

| Field | Type | Description |
|---|---|---|
| `date` | `string` | When this data was last refreshed (ISO 8601) |
| `event.year` | `number` | Event year, e.g. `2026` |
| `event.start` | `string` | Event start (ISO 8601), normally 1 December 17:00 UTC |
| `event.end` | `string` | Event end (ISO 8601), normally 15 December 08:00 UTC |
| `dollarConversionRate` | `number` | GBP → USD rate. Multiply a pound amount by this to get dollars |
| `raised` | `number` | Total raised by the whole event, in pounds |
| `collections.redeemed` | `number` | Number of Jingle Jam game collections claimed |
| `collections.total` | `number` | Number of collections available |
| `donations` | `number` | Total number of donations |
| `history` | [`DonationHistory[]`](#donationhistory) | Final totals for every previous year, oldest first |
| `causes` | [`Cause[]`](#cause) | Every cause, with the amount raised for it |
| `campaigns.count` | `number` | Total number of campaigns |
| `campaigns.live` | `number` | Number of campaigns streaming right now (across all campaigns, not only the top 100) |
| `campaigns.list` | [`Campaign[]`](#campaign) | Top 100 campaigns, highest raised first |

#### Example

```bash
curl https://dashboard.jinglejam.co.uk/api/tiltify
```

```json
{
  "date": "2025-12-07T19:42:10.412Z",
  "event": {
    "year": 2025,
    "start": "2025-12-01T17:00:00.000Z",
    "end": "2025-12-15T08:00:00.000Z"
  },
  "dollarConversionRate": 1.32,
  "raised": 2415873.52,
  "collections": { "redeemed": 38210, "total": 98000 },
  "donations": 49875,
  "history": [
    {
      "year": 2024,
      "event": { "start": "2024-12-01T17:00:00.000Z", "end": "2024-12-15T00:00:00.000Z" },
      "total": { "dollars": 3398349.81, "pounds": 2673906.16 },
      "donations": 62609,
      "collections": 53341,
      "campaigns": 787
    }
  ],
  "causes": [
    {
      "id": "18cb6ffd-3067-4ca8-8414-74eb733d79fd",
      "slug": "war-child",
      "name": "War Child",
      "logo": "https://assets.jinglejam.no1mann.com/jingle-jam-2026/causes/logos/war-child.webp",
      "borderedLogo": "https://assets.jinglejam.no1mann.com/jingle-jam-2025/causes/war-child.webp",
      "description": "Protecting, educating, and advocating for the rights of children impacted by the ongoing conflicts in Gaza, Ukraine and worldwide.",
      "color": "#cc232a",
      "url": "https://www.warchild.org.uk/",
      "donateUrl": "https://jinglejam.tiltify.com/campaigns?regionId=18cb6ffd-3067-4ca8-8414-74eb733d79fd",
      "raised": 168412.07,
      "campaigns": 49,
      "live": 3
    }
  ],
  "campaigns": {
    "count": 938,
    "live": 27,
    "list": [
      {
        "causeId": "18cb6ffd-3067-4ca8-8414-74eb733d79fd",
        "name": "Example Stream for War Child",
        "description": "Streaming all weekend for War Child!",
        "id": "7a1c4f0e-0000-4000-8000-000000000001",
        "slug": "example-stream-for-war-child",
        "url": "https://tiltify.com/@examplestreamer/example-stream-for-war-child",
        "startTime": "2025-11-20T12:00:00.000Z",
        "raised": 12955.5,
        "goal": 10000,
        "live": true,
        "donationMatchMultiplier": 2,
        "type": "campaign",
        "team": null,
        "user": {
          "name": "ExampleStreamer",
          "slug": "examplestreamer",
          "avatar": "https://assets.tiltify.com/uploads/user/thumbnail/0000/example.png",
          "url": "https://tiltify.com/@examplestreamer"
        }
      }
    ]
  }
}
```

---

### `GET /api/campaigns`

Every campaign for the current event, highest raised first, in pages. Use this when you need campaigns beyond the top 100 included in `/api/tiltify`.

```http
GET /api/campaigns?limit=100&offset=0
```

**Refreshed:** every 10 seconds during the event.

#### Query parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | integer, `1`–`100` | `100` | Number of campaigns to return |
| `offset` | integer, `0` or more | `0` | Number of campaigns to skip |

#### Response

| Field | Type | Description |
|---|---|---|
| `campaigns` | [`Campaign[]`](#campaign) | This page of campaigns |
| `total` | `number` | Total number of campaigns across all pages |
| `limit` | `number` | The `limit` used |
| `offset` | `number` | The `offset` used |

An `offset` past the end returns an empty `campaigns` array.

#### Errors

| Status | Body |
|---|---|
| `400` | `{"error": "Invalid limit parameter. Limit must be between 1 and 100."}` |
| `400` | `{"error": "Invalid offset parameter. Offset must be a positive number (0 or greater)."}` |

#### Example

```bash
# First 50 campaigns
curl "https://dashboard.jinglejam.co.uk/api/campaigns?limit=50"

# Next 50
curl "https://dashboard.jinglejam.co.uk/api/campaigns?limit=50&offset=50"
```

```json
{
  "campaigns": [
    {
      "causeId": null,
      "name": "Jingle Jam 2025",
      "description": "Join the Jingle Jam for daily livestreams...",
      "id": "7f6e131d-e6cf-4659-9d48-7b4af11e498c",
      "slug": "jingle-jam-2025",
      "url": "https://tiltify.com/@yogscast/jingle-jam-2025",
      "startTime": "2025-11-01T10:00:00.000Z",
      "raised": 1747432.18,
      "goal": 100,
      "live": false,
      "donationMatchMultiplier": 1,
      "type": "campaign",
      "team": null,
      "user": {
        "name": "yogscast",
        "slug": "yogscast",
        "avatar": "https://assets.tiltify.com/uploads/user/thumbnail/0000/yogscast.png",
        "url": "https://tiltify.com/@yogscast"
      }
    }
  ],
  "total": 938,
  "limit": 50,
  "offset": 0
}
```

---

### `GET /api/causes/{cause}`

One cause's total and its top campaigns. This is the endpoint behind the [cause trackers](WEB-PAGES.md#cause-tracker).

```http
GET /api/causes/{cause}?limit=10
```

**Refreshed:** every 10 seconds during the event.

#### Path parameters

| Parameter | Description |
|---|---|
| `cause` | The cause's `slug` (e.g. `war-child`) or `id`, as listed in `causes` from [`/api/tiltify`](#get-apitiltify). Not case-sensitive. Use **`jingle-jam`** for the whole event, covering every cause and campaign. |

The slug is the cause name in lowercase, with spaces replaced by hyphens and other punctuation removed, so each new cause gets an endpoint automatically. For the causes in the 2025 event:

`autistica` · `become` · `calm` · `the-grand-appeal` · `make-a-wish` · `the-trevor-project` · `war-child` · `wwf`

#### Query parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | integer, `1`–`100` | `10` | Number of top campaigns to include |

#### Response

| Field | Type | Description |
|---|---|---|
| `date` | `string` | When this data was last refreshed (ISO 8601) |
| `event` | `object` | `year`, `start` and `end`, the same as [`/api/tiltify`](#get-apitiltify) |
| `dollarConversionRate` | `number` | GBP → USD rate |
| `raised` | `number` | Total raised by the **whole event**, in pounds |
| `scope` | `"cause"` \| `"event"` | `"event"` when requested with `jingle-jam` |
| `cause` | [`Cause`](#cause) | The cause, including the amount raised for it |
| `campaigns.count` | `number` | Number of campaigns dedicated to this cause |
| `campaigns.live` | `number` | Of those, the number streaming right now |
| `campaigns.matching` | `number` | Of those, the number with an active donation match |
| `campaigns.list` | [`Campaign[]`](#campaign) | Top `limit` campaigns for this cause, highest raised first |

> [!NOTE]
> Campaigns that support **all causes** are split equally between every cause. Their share is included in `cause.raised`, but they are **not** listed in `campaigns` or counted in `campaigns.count`. That means `cause.raised` can be more than the sum of the listed campaigns.
>
> For `jingle-jam`, `cause` describes the whole event (its `id` is the Tiltify fundraiser ID), and `campaigns` covers every campaign.

#### Errors

| Status | Body |
|---|---|
| `400` | `{"error": "Invalid limit parameter. Limit must be between 1 and 100."}` |
| `404` | `{"error": "Cause not found."}` |

#### Example

```bash
curl "https://dashboard.jinglejam.co.uk/api/causes/war-child?limit=5"
```

```json
{
  "date": "2025-12-07T19:42:10.412Z",
  "event": {
    "year": 2025,
    "start": "2025-12-01T17:00:00.000Z",
    "end": "2025-12-15T08:00:00.000Z"
  },
  "dollarConversionRate": 1.32,
  "raised": 2415873.52,
  "scope": "cause",
  "cause": {
    "id": "18cb6ffd-3067-4ca8-8414-74eb733d79fd",
    "slug": "war-child",
    "name": "War Child",
    "logo": "https://assets.jinglejam.no1mann.com/jingle-jam-2026/causes/logos/war-child.webp",
    "borderedLogo": "https://assets.jinglejam.no1mann.com/jingle-jam-2025/causes/war-child.webp",
    "description": "Protecting, educating, and advocating for the rights of children impacted by the ongoing conflicts in Gaza, Ukraine and worldwide.",
    "color": "#cc232a",
    "url": "https://www.warchild.org.uk/",
    "donateUrl": "https://jinglejam.tiltify.com/campaigns?regionId=18cb6ffd-3067-4ca8-8414-74eb733d79fd",
    "raised": 168412.07,
    "campaigns": 49,
    "live": 3
  },
  "campaigns": {
    "count": 49,
    "live": 3,
    "matching": 1,
    "list": [
      {
        "causeId": "18cb6ffd-3067-4ca8-8414-74eb733d79fd",
        "name": "Example Stream for War Child",
        "description": "Streaming all weekend for War Child!",
        "id": "7a1c4f0e-0000-4000-8000-000000000001",
        "slug": "example-stream-for-war-child",
        "url": "https://tiltify.com/@examplestreamer/example-stream-for-war-child",
        "startTime": "2025-11-20T12:00:00.000Z",
        "raised": 12955.5,
        "goal": 10000,
        "live": true,
        "donationMatchMultiplier": 2,
        "type": "campaign",
        "team": null,
        "user": {
          "name": "ExampleStreamer",
          "slug": "examplestreamer",
          "avatar": "https://assets.tiltify.com/uploads/user/thumbnail/0000/example.png",
          "url": "https://tiltify.com/@examplestreamer"
        }
      }
    ]
  }
}
```

---

### `GET /api/graph/current`

The current event's total over time, for drawing a graph.

```http
GET /api/graph/current
```

**Refreshed:** a new point is added every **10 minutes** while the event is running.

#### Response

An array of points, oldest first:

| Field | Type | Description |
|---|---|---|
| `date` | `number` | Time of the point, as a Unix timestamp in **milliseconds** |
| `p` | `number` | Total raised at that time, in pounds |
| `d` | `number` | Total raised at that time, in dollars |

The first point is always the event start with a value of `0`. Before the event begins, that is the only point.

#### Example

```bash
curl https://dashboard.jinglejam.co.uk/api/graph/current
```

```json
[
  { "date": 1764608400000, "p": 0,         "d": 0 },
  { "date": 1764609000000, "p": 51230.25,  "d": 67623.93 },
  { "date": 1764609600000, "p": 98410.5,   "d": 129901.86 }
]
```

---

### `GET /api/graph/previous`

The total over time for every previous event from 2016 onwards, for comparing this year against past years.

```http
GET /api/graph/previous
```

**Refreshed:** once a year, after each event.

#### Response

An array of points, grouped by year, oldest first:

| Field | Type | Description |
|---|---|---|
| `timestamp` | `string` | Time of the point (ISO 8601 in UTC, without a `Z` suffix) |
| `year` | `number` | Event year |
| `amountPounds` | `number` | Total raised at that time, in pounds |
| `amountDollars` | `number` | Total raised at that time, in dollars |

The time between points varies from year to year. The response is large (about 1.5 MB) and only changes once a year, so fetch it once and cache it.

#### Example

```bash
curl https://dashboard.jinglejam.co.uk/api/graph/previous
```

```json
[
  { "timestamp": "2016-12-01T17:00:00", "year": 2016, "amountDollars": 0,        "amountPounds": 0 },
  { "timestamp": "2016-12-01T17:20:00", "year": 2016, "amountDollars": 38483.86, "amountPounds": 30584.66 },
  { "timestamp": "2017-12-01T17:00:00", "year": 2017, "amountDollars": 0,        "amountPounds": 0 }
]
```

---

## Types

### `Cause`

A charity supported by the Jingle Jam.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Tiltify UUID of the cause |
| `slug` | `string` | URL-friendly name, e.g. `war-child`. Used by [`/api/causes/{cause}`](#get-apicausescause) and the `/tracker/{cause}` pages |
| `name` | `string` | Display name |
| `logo` | `string` | Logo image URL: the bare logo on a transparent background, trimmed to its edges (fixed height, width varies with the logo) |
| `borderedLogo` | `string` | Square logo image URL with a border and background, used for thumbnails |
| `description` | `string` | Short description of the cause |
| `color` | `string` | Brand colour as a hex code, e.g. `#cc232a` |
| `url` | `string` | The cause's own website |
| `donateUrl` | `string` | Tiltify page listing campaigns for this cause |
| `raised` | `number` | Amount raised for this cause, in pounds, including its equal share of campaigns that support all causes |
| `campaigns` | `number` | Number of campaigns dedicated to this cause |
| `live` | `number` | Number of those campaigns streaming right now |

### `Campaign`

A fundraiser on Tiltify, usually a streamer's or a team's.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Tiltify UUID of the campaign |
| `slug` | `string` | Tiltify slug of the campaign |
| `name` | `string` | Campaign name |
| `description` | `string` | Campaign description, cut to 1,024 characters (with `...` added) |
| `url` | `string` | Campaign page on Tiltify |
| `causeId` | `string \| null` | `id` of the cause it supports, or `null` if it supports all causes |
| `startTime` | `string \| null` | When the campaign was published (ISO 8601) |
| `raised` | `number` | Amount raised, in pounds |
| `goal` | `number` | Fundraising goal, in pounds (`0` if none) |
| `live` | `boolean` | Whether the campaign is streaming right now |
| `donationMatchMultiplier` | `number` | `1` = no match, `2` = donations are currently matched 2×, `3` = 3×, and so on |
| `type` | `string` | `"campaign"` for a single fundraiser, or `"team_event"` for a team event |
| `team` | `object \| null` | The team the campaign belongs to, or `null` |
| `team.name` | `string` | Team name |
| `team.slug` | `string` | Team slug |
| `team.avatar` | `string` | Team avatar URL |
| `team.url` | `string` | Team page on Tiltify |
| `user.name` | `string` | Owner's display name |
| `user.slug` | `string` | Owner's slug |
| `user.avatar` | `string` | Owner's avatar URL (may be empty) |
| `user.url` | `string` | Owner's page on Tiltify |

### `DonationHistory`

The final result of one previous year.

| Field | Type | Description |
|---|---|---|
| `year` | `number` | Event year (from 2011) |
| `event.start` | `string` | Event start (ISO 8601) |
| `event.end` | `string` | Event end (ISO 8601) |
| `total.pounds` | `number` | Total raised, in pounds |
| `total.dollars` | `number` | Total raised, in dollars |
| `donations` | `number` | Number of donations |
| `collections` | `number?` | Collections claimed (2020 onwards) |
| `campaigns` | `number?` | Number of Tiltify campaigns (2021 onwards) |

<details>
<summary><b>TypeScript definitions</b></summary>

```ts
interface Summary {                 // GET /api/tiltify
  date: string;
  event: { year: number; start: string; end: string };
  dollarConversionRate: number;
  raised: number;
  collections: { redeemed: number; total: number };
  donations: number;
  history: DonationHistory[];
  causes: Cause[];
  campaigns: { count: number; live: number; list: Campaign[] };
}

interface CampaignPage {            // GET /api/campaigns
  campaigns: Campaign[];
  total: number;
  limit: number;
  offset: number;
}

interface CauseSummary {            // GET /api/causes/{cause}
  date: string;
  event: { year: number; start: string; end: string };
  dollarConversionRate: number;
  raised: number;
  scope: 'cause' | 'event';
  cause: Cause;
  campaigns: { count: number; live: number; matching: number; list: Campaign[] };
}

interface CurrentGraphPoint {       // GET /api/graph/current
  date: number;   // Unix ms
  p: number;      // pounds
  d: number;      // dollars
}

interface PreviousGraphPoint {      // GET /api/graph/previous
  timestamp: string;
  year: number;
  amountDollars: number;
  amountPounds: number;
}

interface Cause {
  id: string;
  slug: string;
  name: string;
  logo: string;
  borderedLogo: string;
  description: string;
  color: string;
  url: string;
  donateUrl: string;
  raised: number;
  campaigns: number;
  live: number;
}

interface Campaign {
  id: string;
  slug: string;
  name: string;
  description: string;
  url: string;
  causeId: string | null;
  startTime: string | null;
  raised: number;
  goal: number;
  live: boolean;
  donationMatchMultiplier: number;
  type: string;
  team: { name: string; slug: string; avatar: string; url: string } | null;
  user: { name: string; slug: string; avatar: string; url: string };
}

interface DonationHistory {
  year: number;
  event: { start: string; end: string };
  total: { dollars: number; pounds: number };
  donations: number;
  collections?: number;
  campaigns?: number;
}
```

</details>

---

## Errors

| Status | When | Body |
|---|---|---|
| `400 Bad Request` | A query parameter is invalid | `{"error": "<message>"}` |
| `404 Not Found` | The cause in [`/api/causes/{cause}`](#get-apicausescause) doesn't exist | `{"error": "Cause not found."}` |
| `500 Internal Server Error` | Something went wrong on our side | Plain text `Internal Server Error` |

> [!WARNING]
> A path that isn't one of the endpoints above (e.g. a typo like `/api/tiltfy`) does **not** return a 404. It falls through to the website and returns HTML with status `200`. If JSON parsing fails, check the URL first.

If Tiltify is briefly unavailable, the API keeps serving the last good data instead of returning an error. Check `date` if you need to know how old the data is.

## CORS

Every endpoint allows cross-origin requests from any website:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD, POST, OPTIONS
Access-Control-Max-Age: 86400
```

`OPTIONS` preflight requests return `204 No Content`. Although `HEAD` is listed, only `GET` is actually served, so use `GET`.

---

## Admin endpoints

> [!CAUTION]
> These endpoints are for the tracker's maintainers. They need the secret admin token and overwrite live data.

Both endpoints need an `Authorization` header set to the admin token, **exactly as is** (no `Bearer` prefix). A missing or wrong token returns `401 Unauthorized`. A successful call returns `200` with the text `Manual Update Success`.

| Endpoint | Body | Effect |
|---|---|---|
| `POST /api/tiltify` | A full [`/api/tiltify`](#get-apitiltify) response | Replaces the cached summary. It is replaced again at the next refresh, if refreshing is on. |
| `POST /api/graph/current` | An array of [graph points](#get-apigraphcurrent) | Replaces this year's graph. Send `[]` to clear it. |

```bash
# Replace the summary
curl -X POST https://dashboard.jinglejam.co.uk/api/tiltify \
  -H "Authorization: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @summary.json

# Clear the graph at the start of a new year
curl -X POST https://dashboard.jinglejam.co.uk/api/graph/current \
  -H "Authorization: $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[]'
```

See [Local Development → Admin token](LOCAL-DEVELOPMENT.md#admin-token) for how the token is set.
