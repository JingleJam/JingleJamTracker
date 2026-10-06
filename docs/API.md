# 📖 API Reference

[← Back to README](../README.md) · [Web Pages](WEB-PAGES.md) · [Architecture](ARCHITECTURE.md) · [Local Development](LOCAL-DEVELOPMENT.md)

The Jingle Jam Tracker API is a free, public, read-only JSON API with live and historical Jingle Jam fundraising data. It needs **no API key**, and **CORS is enabled**, so you can call it from a server, a script, a bot or straight from a web page.

```bash
curl https://dashboard.jinglejam.co.uk/api/v1/event
```

An [OpenAPI 3.1 spec](../website/openapi.yaml) is served at [`/openapi.yaml`](https://dashboard.jinglejam.co.uk/openapi.yaml), for generating clients or loading into tools like Postman. To browse it and try the endpoints out, open [`/swagger`](https://dashboard.jinglejam.co.uk/swagger).

> [!NOTE]
> This is version 1 of the API, at `/api/v1/`. The endpoints from the 2025 event (`/api/tiltify`, `/api/campaigns` and `/api/graph/*`) keep working through the 2026 event and **will be removed before the 2027 event**. See [Legacy endpoints](#legacy-endpoints) for how to move over.

## Contents

- [Base URLs](#base-urls)
- [Usage guidelines](#usage-guidelines)
- [Endpoints](#endpoints)
  - [`GET /api/v1/event`](#get-apiv1event): the current event, with the top 25 campaigns
  - [`GET /api/v1/causes`](#get-apiv1causes): every cause
  - [`GET /api/v1/causes/{cause}`](#get-apiv1causescause): a single cause, with its top campaigns
  - [`GET /api/v1/campaigns`](#get-apiv1campaigns): every campaign and team event, paginated and searchable
  - [`GET /api/v1/campaigns/{id}`](#get-apiv1campaignsid): a single campaign or team event, with live data
  - [`GET /api/v1/timeline`](#get-apiv1timeline): this year's total over time
  - [`GET /api/v1/timeline/history`](#get-apiv1timelinehistory): previous years' totals over time
- [Types](#types): `Meta`, `CampaignCollection`, `RaisedBreakdown`, `Cause`, `Campaign`, `YearResult`, `Social`, `DonationMatch`, `Reward`, `TopDonor`, `LatestDonation`
- [Errors](#errors)
- [CORS](#cors)
- [Legacy endpoints](#legacy-endpoints)
- [Admin endpoints](#admin-endpoints) (maintainers only)

---

## Base URLs

| Environment | Base URL | Use it for |
|---|---|---|
| **Production** | `https://dashboard.jinglejam.co.uk` | Anything real |
| Development | `https://develop.jingle-jam-tracker.pages.dev` | Trying out upcoming changes. It may include test data and can break without notice. |
| Local | `http://127.0.0.1:8788` | Working on this repository ([Local Development](LOCAL-DEVELOPMENT.md)) |

Every endpoint path below is relative to the base URL, e.g. `https://dashboard.jinglejam.co.uk/api/v1/event`.

## Usage guidelines

The API is free for anyone to use. To keep it fast and affordable for everyone, please follow these guidelines:

> [!IMPORTANT]
> **Make at most 1 request per second**, counted across all of your users combined, not per user.

- **Don't poll faster than every 10 seconds.** During the event the data refreshes every 10 seconds (less often outside it), so faster polling returns the same response. Every response except the two timelines has a `meta.updatedAt` field saying when it was last refreshed, so you can schedule your next request for about 15 seconds after that time.
- **Put a cache in front of the API if you have many users.** If your app, website, bot or overlay has lots of users, fetch from your own server and serve those users from your cache, instead of having every client call the API directly.
- **Fetch only what you need.** `/api/v1/event` already includes the top 25 campaigns, and `/api/v1/causes/{cause}` a cause's top campaigns. To find a particular campaign, use `search` on `/api/v1/campaigns` instead of paging through every campaign.
- **Poll single campaigns and team events at most every 30 seconds.** [`/api/v1/campaigns/{id}`](#get-apiv1campaignsid) fetches live data from Tiltify, which is reused for 30 seconds.
- **Link back to the Jingle Jam** ([jinglejam.co.uk](https://www.jinglejam.co.uk)) where it makes sense, so people can donate.

---

## Endpoints

All endpoints are `GET` requests that return JSON (`Content-Type: application/json;charset=UTF-8`). All amounts are in **pounds (GBP)** unless the field name says otherwise.

Every response except the two timelines starts with a [`meta`](#meta) object. Lists of campaigns are always a [`CampaignCollection`](#campaign-collection): one page of campaigns plus counts for every campaign that matched.

```json
{
  "meta": {
    "updatedAt": "2026-12-07T19:42:10.412Z",
    "event": {
      "year": 2026,
      "startsAt": "2026-12-01T17:00:00.000Z",
      "endsAt": "2026-12-15T08:00:00.000Z"
    },
    "dollarConversionRate": 1.32
  },
  ...
}
```

### `GET /api/v1/event`

The current event: the total raised, donation and collection counts, a total for each cause, yearly history and the top 25 campaigns.

```http
GET /api/v1/event
```

**Refreshed:** every 10 seconds during the event.

#### Response

| Field | Type | Description |
|---|---|---|
| `meta` | [`Meta`](#meta) | When the data was refreshed, the event dates and the GBP → USD rate |
| `raised` | `number` | Total raised by the whole event, in pounds |
| `raisedBreakdown` | [`RaisedBreakdown`](#raisedbreakdown) | `raised` split into money given to specific causes (`direct`) and money given to every cause (`shared`) |
| `donations` | `number` | Total number of donations |
| `collections.redeemed` | `number` | Number of Jingle Jam game collections claimed |
| `collections.total` | `number` | Number of collections available |
| `history` | [`YearResult[]`](#yearresult) | Final totals for every previous year, oldest first |
| `causes` | [`Cause[]`](#cause) | Every cause, with the amount raised for it |
| `campaigns` | [`CampaignCollection`](#campaign-collection) | The top 25 campaigns, highest raised first. `total` and `live` count every campaign in the event. `limit` is always `25`. |

This endpoint takes no query parameters. For more campaigns, use [`/api/v1/campaigns`](#get-apiv1campaigns).

#### Example

```bash
curl https://dashboard.jinglejam.co.uk/api/v1/event
```

```json
{
  "meta": {
    "updatedAt": "2025-12-07T19:42:10.412Z",
    "event": { "year": 2025, "startsAt": "2025-12-01T17:00:00.000Z", "endsAt": "2025-12-15T08:00:00.000Z" },
    "dollarConversionRate": 1.32
  },
  "raised": 2415873.52,
  "raisedBreakdown": { "direct": 1950102.40, "shared": 465771.12 },
  "donations": 49875,
  "collections": { "redeemed": 38210, "total": 98000 },
  "history": [
    {
      "year": 2024,
      "event": { "startsAt": "2024-12-01T17:00:00.000Z", "endsAt": "2024-12-15T00:00:00.000Z" },
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
      "raisedBreakdown": { "direct": 110190.68, "shared": 58221.39 },
      "campaigns": 49,
      "live": 3
    }
  ],
  "campaigns": {
    "total": 938,
    "live": 27,
    "limit": 25,
    "offset": 0,
    "items": [
      {
        "id": "7a1c4f0e-0000-4000-8000-000000000001",
        "slug": "example-stream-for-war-child",
        "name": "Example Stream for War Child",
        "description": "Streaming all weekend for War Child!",
        "url": "https://tiltify.com/@examplestreamer/example-stream-for-war-child",
        "cause": { "id": "18cb6ffd-3067-4ca8-8414-74eb733d79fd", "slug": "war-child", "name": "War Child", "color": "#cc232a" },
        "raised": 12955.5,
        "goal": 10000,
        "live": true,
        "donationMatchMultiplier": 2,
        "type": "campaign",
        "team": null,
        "teamEvent": null,
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

### `GET /api/v1/causes`

Every cause in the current event, with the amount raised for each.

```http
GET /api/v1/causes
```

**Refreshed:** every 10 seconds during the event.

#### Response

| Field | Type | Description |
|---|---|---|
| `meta` | [`Meta`](#meta) | When the data was refreshed, the event dates and the GBP → USD rate |
| `causes` | [`Cause[]`](#cause) | Every cause, the same as `causes` in [`/api/v1/event`](#get-apiv1event) |

#### Example

```bash
curl https://dashboard.jinglejam.co.uk/api/v1/causes
```

```json
{
  "meta": {
    "updatedAt": "2025-12-07T19:42:10.412Z",
    "event": { "year": 2025, "startsAt": "2025-12-01T17:00:00.000Z", "endsAt": "2025-12-15T08:00:00.000Z" },
    "dollarConversionRate": 1.32
  },
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
      "raisedBreakdown": { "direct": 110190.68, "shared": 58221.39 },
      "campaigns": 49,
      "live": 3
    }
  ]
}
```

---

### `GET /api/v1/causes/{cause}`

One cause and its top campaigns. This is the endpoint behind the [cause trackers](WEB-PAGES.md#cause-tracker).

```http
GET /api/v1/causes/{cause}?limit=25&offset=0
```

**Refreshed:** every 10 seconds during the event.

#### Path parameters

| Parameter | Description |
|---|---|
| `cause` | The cause's `slug` (e.g. `war-child`) or `id`, as listed in [`/api/v1/causes`](#get-apiv1causes). Not case-sensitive. |

The slug is the cause name in lowercase, with spaces replaced by hyphens and other punctuation removed, so each new cause gets an endpoint automatically.

#### Query parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | integer, `1`–`100` | `25` | Number of campaigns to return |
| `offset` | integer, `0` or more | `0` | Number of campaigns to skip |

#### Response

| Field | Type | Description |
|---|---|---|
| `meta` | [`Meta`](#meta) | When the data was refreshed, the event dates and the GBP → USD rate |
| `cause` | [`Cause`](#cause) | The cause, including the amount raised for it |
| `campaigns` | [`CampaignCollection`](#campaign-collection) | Campaigns dedicated to this cause, highest raised first |

> [!NOTE]
> Campaigns that support **all causes** are split equally between every cause. Their share is included in `cause.raised` (as `cause.raisedBreakdown.shared`), but they are **not** listed in `campaigns` or counted in `campaigns.total`. That means `cause.raised` can be more than the sum of the listed campaigns.

#### Errors

| Status | Body |
|---|---|
| `400` | `{"error": "Invalid limit parameter. Limit must be between 1 and 100."}` |
| `400` | `{"error": "Invalid offset parameter. Offset must be a positive number (0 or greater)."}` |
| `404` | `{"error": "Cause not found."}` |

#### Example

```bash
curl "https://dashboard.jinglejam.co.uk/api/v1/causes/war-child?limit=5"
```

```json
{
  "meta": {
    "updatedAt": "2025-12-07T19:42:10.412Z",
    "event": { "year": 2025, "startsAt": "2025-12-01T17:00:00.000Z", "endsAt": "2025-12-15T08:00:00.000Z" },
    "dollarConversionRate": 1.32
  },
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
    "raisedBreakdown": { "direct": 110190.68, "shared": 58221.39 },
    "campaigns": 49,
    "live": 3
  },
  "campaigns": {
    "total": 49,
    "live": 3,
    "limit": 5,
    "offset": 0,
    "items": [
      {
        "id": "7a1c4f0e-0000-4000-8000-000000000001",
        "name": "Example Stream for War Child",
        "cause": { "id": "18cb6ffd-3067-4ca8-8414-74eb733d79fd", "slug": "war-child", "name": "War Child", "color": "#cc232a" },
        "type": "campaign",
        "raised": 12955.5,
        "...": "the other Campaign fields"
      }
    ]
  }
}
```

---

### `GET /api/v1/campaigns`

Every campaign and team event in the current event, in pages. Highest raised first, or best match first when searching.

```http
GET /api/v1/campaigns?limit=25&offset=0&search=spiffing&type=campaign&cause=war-child
```

**Refreshed:** every 10 seconds during the event.

#### Query parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | integer, `1`–`100` | `25` | Number of campaigns to return |
| `offset` | integer, `0` or more | `0` | Number of campaigns to skip |
| `search` | string, up to 100 characters | | Only campaigns whose name, owner's name or team name match. Not case-sensitive, ignores accents and punctuation, and tolerates small typos (`spifing` finds TheSpiffingBrit). Every word has to match. Results are sorted best match first, then by amount raised. |
| `type` | `campaign` or `team_event`, comma-separated | both | Only these kinds of fundraiser. See [`Campaign.type`](#campaign). |
| `cause` | a cause's `slug` or `id` | every cause | Only campaigns dedicated to this cause. Campaigns that support all causes are left out. |

#### Response

| Field | Type | Description |
|---|---|---|
| `meta` | [`Meta`](#meta) | When the data was refreshed, the event dates and the GBP → USD rate |
| `campaigns` | [`CampaignCollection`](#campaign-collection) | This page of campaigns. `total` and `live` count every campaign that matched `search`, `type` and `cause`. |

An `offset` past the end returns an empty `items` array.

#### Errors

| Status | Body |
|---|---|
| `400` | `{"error": "Invalid limit parameter. Limit must be between 1 and 100."}` |
| `400` | `{"error": "Invalid offset parameter. Offset must be a positive number (0 or greater)."}` |
| `400` | `{"error": "Invalid type parameter. Type must be one or more of campaign, team_event, separated by commas."}` |
| `400` | `{"error": "Invalid search parameter. Search must be at most 100 characters."}` |
| `400` | `{"error": "Invalid cause parameter. Cause must be the slug or id of a cause from /api/v1/causes."}` |

#### Example

```bash
# First 25 campaigns
curl "https://dashboard.jinglejam.co.uk/api/v1/campaigns"

# The next 50
curl "https://dashboard.jinglejam.co.uk/api/v1/campaigns?limit=50&offset=25"

# Search for a streamer
curl "https://dashboard.jinglejam.co.uk/api/v1/campaigns?search=yogscast&limit=5"

# Only team events
curl "https://dashboard.jinglejam.co.uk/api/v1/campaigns?type=team_event"

# Campaigns for one cause
curl "https://dashboard.jinglejam.co.uk/api/v1/campaigns?cause=war-child"
```

```json
{
  "meta": {
    "updatedAt": "2025-12-07T19:42:10.412Z",
    "event": { "year": 2025, "startsAt": "2025-12-01T17:00:00.000Z", "endsAt": "2025-12-15T08:00:00.000Z" },
    "dollarConversionRate": 1.32
  },
  "campaigns": {
    "total": 938,
    "live": 27,
    "limit": 25,
    "offset": 0,
    "items": [
      {
        "id": "7f6e131d-e6cf-4659-9d48-7b4af11e498c",
        "slug": "jingle-jam-2025",
        "name": "Jingle Jam 2025",
        "description": "Join the Jingle Jam for daily livestreams...",
        "url": "https://tiltify.com/@yogscast/jingle-jam-2025",
        "cause": { "id": null, "slug": null, "name": "All The Charities", "color": "#e21251" },
        "raised": 1747432.18,
        "goal": 100,
        "live": false,
        "donationMatchMultiplier": 1,
        "type": "campaign",
        "team": null,
        "teamEvent": null,
        "user": {
          "name": "yogscast",
          "slug": "yogscast",
          "avatar": "https://assets.tiltify.com/uploads/user/thumbnail/0000/yogscast.png",
          "url": "https://tiltify.com/@yogscast"
        }
      }
    ]
  }
}
```

---

### `GET /api/v1/campaigns/{id}`

One campaign or team event, with live data fetched from Tiltify: its social links, active donation matches, its own rewards, its top donors and its latest donations. A team event also includes its team's member count and every campaign supporting it.

```http
GET /api/v1/campaigns/{id}
```

**Refreshed:** the campaign every 10 seconds during the event, like [`/api/v1/campaigns`](#get-apiv1campaigns). The live data is fetched from Tiltify when requested and reused for **30 seconds**.

#### Path parameters

| Parameter | Description |
|---|---|
| `id` | The campaign's or team event's `id` from [`/api/v1/campaigns`](#get-apiv1campaigns) or [`/api/v1/event`](#get-apiv1event). Not case-sensitive. Only fundraisers in the current event are found. |

#### Response

| Field | Type | Description |
|---|---|---|
| `meta` | [`Meta`](#meta) | When the data was refreshed, the event dates and the GBP → USD rate |
| `campaign` | [`Campaign`](#campaign) | The campaign or team event. Check `campaign.type` to tell them apart. A team event's `raised` includes its supporting campaigns, and its `raisedBreakdown` splits the two. |
| `social` | [`Social`](#social) | Its social media links |
| `donationMatches` | [`DonationMatch[]`](#donationmatch) | Donation matches active right now |
| `rewards` | [`Reward[]`](#reward) | Active rewards set up by the campaign or its team event. The Jingle Jam Games Collection, which every campaign has, is left out. |
| `topDonors` | [`TopDonor[]`](#topdonor) \| `null` | The top 25 donors, by the total each donor has given, highest first. `null` if the leaderboard is turned off on Tiltify. |
| `latestDonations` | [`LatestDonation[]`](#latestdonation) | The 25 most recent donations, newest first |

Team events only (`campaign.type` is `"team_event"`):

| Field | Type | Description |
|---|---|---|
| `teamMemberCount` | `number \| null` | Number of members of the team, or `null` if Tiltify couldn't be reached |
| `campaigns` | [`CampaignCollection`](#campaign-collection) | Every campaign supporting the team event, highest raised first. They are all in one page, so `limit` equals `total`. |

If Tiltify can't be reached, the last live data fetched is returned. If none has been fetched yet, `social` has every link `null` and the lists are empty.

#### Errors

| Status | Body |
|---|---|
| `404` | `{"error": "Campaign not found."}` |

#### Example

```bash
curl https://dashboard.jinglejam.co.uk/api/v1/campaigns/7a1c4f0e-0000-4000-8000-000000000001
```

```json
{
  "meta": {
    "updatedAt": "2025-12-07T19:42:10.412Z",
    "event": { "year": 2025, "startsAt": "2025-12-01T17:00:00.000Z", "endsAt": "2025-12-15T08:00:00.000Z" },
    "dollarConversionRate": 1.32
  },
  "campaign": {
    "id": "7a1c4f0e-0000-4000-8000-000000000001",
    "slug": "example-stream-for-war-child",
    "name": "Example Stream for War Child",
    "description": "Streaming all weekend for War Child!",
    "url": "https://tiltify.com/@examplestreamer/example-stream-for-war-child",
    "cause": { "id": "18cb6ffd-3067-4ca8-8414-74eb733d79fd", "slug": "war-child", "name": "War Child", "color": "#cc232a" },
    "raised": 12955.5,
    "goal": 10000,
    "live": true,
    "donationMatchMultiplier": 2,
    "type": "campaign",
    "team": null,
    "teamEvent": null,
    "user": {
      "name": "ExampleStreamer",
      "slug": "examplestreamer",
      "avatar": "https://assets.tiltify.com/uploads/user/thumbnail/0000/example.png",
      "url": "https://tiltify.com/@examplestreamer"
    }
  },
  "social": {
    "discord": null,
    "facebook": null,
    "instagram": null,
    "linkedin": null,
    "snapchat": null,
    "tiktok": null,
    "twitch": "https://www.twitch.tv/examplestreamer",
    "twitter": null,
    "website": null,
    "youtube": "https://www.youtube.com/@examplestreamer"
  },
  "donationMatches": [
    {
      "id": "a3f8a017-0000-4000-8000-000000000002",
      "matchedBy": "An Example Sponsor",
      "pledged": 1000,
      "matched": 331,
      "startsAt": "2025-12-07T18:00:00.000Z",
      "endsAt": "2025-12-07T22:00:00.000Z"
    }
  ],
  "rewards": [
    {
      "id": "6226d667-0000-4000-8000-000000000003",
      "name": "Shout-out on stream",
      "description": "Your name read out live.",
      "image": null,
      "amount": 10,
      "quantity": null,
      "remaining": null,
      "startsAt": null,
      "endsAt": null
    }
  ],
  "topDonors": [
    { "name": "Darineth", "amount": 500 },
    { "name": "Anonymous", "amount": 250 }
  ],
  "latestDonations": [
    { "name": "Anonymous", "amount": 35, "comment": "Good luck with the stream!" },
    { "name": "Darineth", "amount": 100, "comment": null }
  ]
}
```

A team event:

```bash
curl https://dashboard.jinglejam.co.uk/api/v1/campaigns/05b4e0a7-ef8c-43b4-9f12-cf7f2ea89907
```

```json
{
  "meta": { "updatedAt": "2025-12-07T19:42:10.412Z", "...": "the other Meta fields" },
  "campaign": {
    "id": "05b4e0a7-ef8c-43b4-9f12-cf7f2ea89907",
    "name": "CoreKeeper Survive-A-Thon",
    "cause": { "id": "5350a34a-8b94-4513-bb1d-22becc2df6e4", "slug": "make-a-wish", "name": "Make-A-Wish", "color": "#0063b8" },
    "type": "team_event",
    "raised": 30277.68,
    "raisedBreakdown": { "teamEvent": 1200, "campaigns": 29077.68 },
    "...": "the other Campaign fields"
  },
  "social": { "discord": null, "twitch": null, "...": "the other Social fields" },
  "donationMatches": [],
  "rewards": [
    { "id": "…", "name": "Exclusive Make-A-Wish Hat", "description": "…", "image": "…", "amount": 5, "quantity": null, "remaining": null, "startsAt": null, "endsAt": null }
  ],
  "topDonors": [{ "name": "Example Donor", "amount": 1000 }],
  "latestDonations": [{ "name": "Anonymous", "amount": 20, "comment": null }],
  "teamMemberCount": 19,
  "campaigns": {
    "total": 13,
    "live": 2,
    "limit": 13,
    "offset": 0,
    "items": [
      { "name": "Laimu's Core Keeper Survive-A-Thon", "type": "campaign", "teamEvent": { "id": "05b4e0a7-ef8c-43b4-9f12-cf7f2ea89907", "name": "CoreKeeper Survive-A-Thon", "slug": "corekeeper-x-make-a-wish-for-jinglejam", "avatar": "https://assets.tiltify.com/uploads/team_event/avatar/…", "url": "https://tiltify.com/+corekeeper-x-make-a-wish-for-jinglejam/corekeeper-x-make-a-wish-for-jinglejam" }, "...": "the other Campaign fields" }
    ]
  }
}
```

---

### `GET /api/v1/timeline`

The current event's total over time, for drawing a graph.

```http
GET /api/v1/timeline
```

**Refreshed:** a new point is added every **10 minutes** while the event is running.

#### Response

An array of points, oldest first. There is no `meta` object.

| Field | Type | Description |
|---|---|---|
| `date` | `number` | Time of the point, as a Unix timestamp in **milliseconds** |
| `p` | `number` | Total raised at that time, in pounds |
| `d` | `number` | Total raised at that time, in dollars |

The first point is always the event start with a value of `0`. Before the event begins, that is the only point.

#### Example

```bash
curl https://dashboard.jinglejam.co.uk/api/v1/timeline
```

```json
[
  { "date": 1764608400000, "p": 0,         "d": 0 },
  { "date": 1764609000000, "p": 51230.25,  "d": 67623.93 },
  { "date": 1764609600000, "p": 98410.5,   "d": 129901.86 }
]
```

---

### `GET /api/v1/timeline/history`

The total over time for every previous event from 2016 onwards, for comparing this year against past years.

```http
GET /api/v1/timeline/history
```

**Refreshed:** once a year, after each event.

#### Response

An array of points, grouped by year, oldest first. There is no `meta` object.

| Field | Type | Description |
|---|---|---|
| `timestamp` | `string` | Time of the point (ISO 8601 in UTC, without a `Z` suffix) |
| `year` | `number` | Event year |
| `amountPounds` | `number` | Total raised at that time, in pounds |
| `amountDollars` | `number` | Total raised at that time, in dollars |

The time between points varies from year to year. The response is large (about 1.5 MB) and only changes once a year, so fetch it once and cache it.

#### Example

```bash
curl https://dashboard.jinglejam.co.uk/api/v1/timeline/history
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

### `Meta`

When the data was last refreshed, the current event's dates and the exchange rate. Every response except the timelines has one, as `meta`.

| Field | Type | Description |
|---|---|---|
| `updatedAt` | `string` | When the data was last refreshed from Tiltify (ISO 8601) |
| `event.year` | `number` | Event year, e.g. `2026` |
| `event.startsAt` | `string` | Event start (ISO 8601), normally 1 December 17:00 UTC |
| `event.endsAt` | `string` | Event end (ISO 8601), normally 15 December 08:00 UTC |
| `dollarConversionRate` | `number` | GBP → USD rate. Multiply a pound amount by this to get dollars |

### Campaign collection

`CampaignCollection`: one page of campaigns, out of every campaign that matched.

| Field | Type | Description |
|---|---|---|
| `total` | `number` | Number of campaigns that matched, across every page |
| `live` | `number` | Of those, the number streaming right now |
| `limit` | `number` | The most campaigns a page holds |
| `offset` | `number` | Number of campaigns skipped before this page |
| `items` | [`Campaign[]`](#campaign) | This page of campaigns |

### `RaisedBreakdown`

An amount raised for a cause (or the whole event), split by who the money was given to. `direct + shared` always equals `raised`.

| Field | Type | Description |
|---|---|---|
| `direct` | `number` | Given to this cause specifically, in pounds: campaigns dedicated to it, plus any manual adjustments. For the event, the total given to specific causes. |
| `shared` | `number` | This cause's equal share of money given to every cause, in pounds: campaigns that support all causes, and donations made straight to the event. For the event, the total given to every cause. |

### `Cause`

A charity supported by the Jingle Jam.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Tiltify UUID of the cause |
| `slug` | `string` | URL-friendly name, e.g. `war-child`. Used by [`/api/v1/causes/{cause}`](#get-apiv1causescause) and the `/causes/{cause}` tracker pages |
| `name` | `string` | Display name |
| `logo` | `string` | Logo image URL: the bare logo on a transparent background, trimmed to its edges (fixed height, width varies with the logo) |
| `borderedLogo` | `string` | Square logo image URL with a border and background, used for thumbnails |
| `description` | `string` | Short description of the cause |
| `color` | `string` | Brand colour as a hex code, e.g. `#cc232a` |
| `url` | `string` | The cause's own website |
| `donateUrl` | `string` | Tiltify page listing campaigns for this cause |
| `raised` | `number` | Amount raised for this cause, in pounds, including its equal share of campaigns that support all causes |
| `raisedBreakdown` | [`RaisedBreakdown`](#raisedbreakdown) | `raised` split into money given to this cause (`direct`) and its share of money given to every cause (`shared`) |
| `campaigns` | `number` | Number of campaigns dedicated to this cause |
| `live` | `number` | Number of those campaigns streaming right now |

### `Campaign`

A fundraiser on Tiltify: a streamer's or a team's campaign, or a team event.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Tiltify UUID of the campaign |
| `slug` | `string` | Tiltify slug of the campaign |
| `name` | `string` | Campaign name |
| `description` | `string` | Campaign description, cut to 1,024 characters (with `...` added) |
| `url` | `string` | Campaign page on Tiltify |
| `cause.id` | `string \| null` | `id` of the cause it supports, or `null` if it supports all causes |
| `cause.slug` | `string \| null` | `slug` of the cause, or `null` if it supports all causes |
| `cause.name` | `string` | Name of the cause, or `"All The Charities"` if it supports all causes |
| `cause.color` | `string` | Colour of the cause as a hex code, or Jingle Jam pink (`#e21251`) if it supports all causes |
| `raised` | `number` | Amount raised, in pounds. A team event's total includes its supporting campaigns. |
| `raisedBreakdown` | `object` | Team events only (not included for other campaigns): `raised` split into donations made to the team event itself and to its supporting campaigns |
| `raisedBreakdown.teamEvent` | `number` | Donated to the team event itself, in pounds |
| `raisedBreakdown.campaigns` | `number` | Donated to its supporting campaigns, in pounds. This comes from Tiltify's totals, so it can differ slightly from adding up the supporting campaigns that are listed. |
| `goal` | `number` | Fundraising goal, in pounds (`0` if none) |
| `live` | `boolean` | Whether the campaign is streaming right now |
| `donationMatchMultiplier` | `number` | `1` = no match, `2` = donations are currently matched 2×, `3` = 3×, and so on |
| `type` | `"campaign" \| "team_event"` | `"team_event"` for a team event. Everything else is `"campaign"`: user and team campaigns, the campaigns supporting a team event, and auction houses. |
| `team` | `object \| null` | The team the campaign belongs to, or `null` |
| `team.name` | `string` | Team name |
| `team.slug` | `string` | Team slug |
| `team.avatar` | `string` | Team avatar URL |
| `team.url` | `string` | Team page on Tiltify |
| `teamEvent` | `object \| null` | The team event this campaign supports, or `null` |
| `teamEvent.id` | `string` | Tiltify UUID of the team event, for [`/api/v1/campaigns/{id}`](#get-apiv1campaignsid) |
| `teamEvent.name` | `string` | Team event name |
| `teamEvent.slug` | `string` | Team event slug |
| `teamEvent.avatar` | `string` | Team event avatar URL (may be empty) |
| `teamEvent.url` | `string` | Team event page on Tiltify |
| `user.name` | `string` | Owner's display name |
| `user.slug` | `string` | Owner's slug |
| `user.avatar` | `string` | Owner's avatar URL (may be empty) |
| `user.url` | `string` | Owner's page on Tiltify |

### `YearResult`

The final result of one previous year.

| Field | Type | Description |
|---|---|---|
| `year` | `number` | Event year (from 2011) |
| `event.startsAt` | `string` | Event start (ISO 8601) |
| `event.endsAt` | `string` | Event end (ISO 8601) |
| `total.pounds` | `number` | Total raised, in pounds |
| `total.dollars` | `number` | Total raised, in dollars |
| `donations` | `number` | Number of donations |
| `collections` | `number?` | Collections claimed (2020 onwards) |
| `campaigns` | `number?` | Number of Tiltify campaigns (2021 onwards) |

### `Social`

A campaign's or team event's social media links. Every field is a URL, or `null` if it isn't set.

| Field | Type |
|---|---|
| `discord`, `facebook`, `instagram`, `linkedin`, `snapchat`, `tiktok`, `twitch`, `twitter`, `website`, `youtube` | `string \| null` |

### `DonationMatch`

A sponsor matching donations, pound for pound, up to a pledged amount.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Tiltify UUID of the match |
| `matchedBy` | `string` | Who is matching the donations |
| `pledged` | `number` | The most the sponsor will match, in pounds |
| `matched` | `number` | The amount matched so far, in pounds |
| `startsAt` | `string \| null` | When the match started (ISO 8601) |
| `endsAt` | `string \| null` | When the match ends (ISO 8601) |

### `Reward`

Something a donor gets for donating at least `amount`.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Tiltify UUID of the reward |
| `name` | `string` | Reward name |
| `description` | `string` | Reward description |
| `image` | `string \| null` | Image URL |
| `amount` | `number` | Minimum donation, in pounds |
| `quantity` | `number \| null` | How many are available in total, or `null` if unlimited |
| `remaining` | `number \| null` | How many are left, or `null` if unlimited |
| `startsAt` | `string \| null` | When the reward becomes available (ISO 8601) |
| `endsAt` | `string \| null` | When the reward stops being available (ISO 8601) |

### `LatestDonation`

One donation, from the most recent donations to a campaign or team event.

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Donor's name as shown on Tiltify (often `Anonymous`) |
| `amount` | `number` | The donation, in pounds |
| `comment` | `string \| null` | The donor's comment, or `null` |

### `TopDonor`

One entry of a donor leaderboard. A donor's donations are added together.

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Donor's name as shown on Tiltify (often `Anonymous`) |
| `amount` | `number` | The donor's total, in pounds |

<details>
<summary><b>TypeScript definitions</b></summary>

```ts
interface Meta {
  updatedAt: string;
  event: { year: number; startsAt: string; endsAt: string };
  dollarConversionRate: number;
}

interface CampaignCollection {
  total: number;
  live: number;
  limit: number;
  offset: number;
  items: Campaign[];
}

interface RaisedBreakdown {
  direct: number;
  shared: number;
}

interface EventResponse {                   // GET /api/v1/event
  meta: Meta;
  raised: number;
  raisedBreakdown: RaisedBreakdown;
  donations: number;
  collections: { redeemed: number; total: number };
  history: YearResult[];
  causes: Cause[];
  campaigns: CampaignCollection;            // Top 25
}

interface CausesResponse {                  // GET /api/v1/causes
  meta: Meta;
  causes: Cause[];
}

interface CauseResponse {                   // GET /api/v1/causes/{cause}
  meta: Meta;
  cause: Cause;
  campaigns: CampaignCollection;
}

interface CampaignsResponse {               // GET /api/v1/campaigns
  meta: Meta;
  campaigns: CampaignCollection;
}

interface CampaignResponse {                // GET /api/v1/campaigns/{id}
  meta: Meta;
  campaign: Campaign;
  social: Social;
  donationMatches: DonationMatch[];
  rewards: Reward[];
  topDonors: TopDonor[] | null;
  latestDonations: LatestDonation[];
  teamMemberCount?: number | null;          // Team events only
  campaigns?: CampaignCollection;           // Team events only
}

interface TimelinePoint {                   // GET /api/v1/timeline
  date: number;   // Unix ms
  p: number;      // pounds
  d: number;      // dollars
}

interface TimelineHistoryPoint {            // GET /api/v1/timeline/history
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
  raisedBreakdown: RaisedBreakdown;
  campaigns: number;
  live: number;
}

interface Campaign {
  id: string;
  slug: string;
  name: string;
  description: string;
  url: string;
  cause: { id: string | null; slug: string | null; name: string; color: string };
  raised: number;
  raisedBreakdown?: { teamEvent: number; campaigns: number };   // Team events only
  goal: number;
  live: boolean;
  donationMatchMultiplier: number;
  type: 'campaign' | 'team_event';
  team: { name: string; slug: string; avatar: string; url: string } | null;
  teamEvent: { id: string; name: string; slug: string; avatar: string; url: string } | null;
  user: { name: string; slug: string; avatar: string; url: string };
}

interface YearResult {
  year: number;
  event: { startsAt: string; endsAt: string };
  total: { dollars: number; pounds: number };
  donations: number;
  collections?: number;
  campaigns?: number;
}

interface Social {
  discord: string | null;
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
  snapchat: string | null;
  tiktok: string | null;
  twitch: string | null;
  twitter: string | null;
  website: string | null;
  youtube: string | null;
}

interface DonationMatch {
  id: string;
  matchedBy: string;
  pledged: number;
  matched: number;
  startsAt: string | null;
  endsAt: string | null;
}

interface Reward {
  id: string;
  name: string;
  description: string;
  image: string | null;
  amount: number;
  quantity: number | null;
  remaining: number | null;
  startsAt: string | null;
  endsAt: string | null;
}

interface LatestDonation {
  name: string;
  amount: number;
  comment: string | null;
}

interface TopDonor {
  name: string;
  amount: number;
}
```

</details>

---

## Errors

Every error has a JSON body with an `error` message:

```json
{ "error": "Cause not found." }
```

| Status | When | Body |
|---|---|---|
| `400 Bad Request` | A query parameter is invalid | `{"error": "<message>"}`, listed under each endpoint |
| `401 Unauthorized` | An [admin endpoint](#admin-endpoints) was called without the right token | `{"error": "Unauthorized."}` |
| `404 Not Found` | The cause or campaign doesn't exist in the current event | `{"error": "Cause not found."}` / `{"error": "Campaign not found."}` |
| `404 Not Found` | The path isn't an endpoint, e.g. a typo like `/api/v1/evnt` | `{"error": "Not found."}` |
| `405 Method Not Allowed` | The endpoint exists, but not for this method (e.g. `POST` to a public endpoint) | `{"error": "Method not allowed."}` |
| `500 Internal Server Error` | Something went wrong on our side | `{"error": "Internal server error."}` |

If Tiltify is briefly unavailable, the API keeps serving the last good data instead of returning an error. Check `meta.updatedAt` if you need to know how old the data is.

## CORS

Every endpoint allows cross-origin requests from any website:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Max-Age: 86400
```

`OPTIONS` preflight requests return `204 No Content`. The two endpoints with an [admin](#admin-endpoints) `POST` (`/api/v1/event` and `/api/v1/timeline`) list `GET, POST, OPTIONS` instead.

---

## Legacy endpoints

> [!WARNING]
> These endpoints are from the 2025 event. They keep working through the 2026 event and **will be removed before the 2027 event**. Please move to the v1 endpoints.

| Old endpoint | What it does now | Move to |
|---|---|---|
| `GET /api/tiltify` | Returns the 2025 response, unchanged (see below) | [`/api/v1/event`](#get-apiv1event) |
| `GET /api/campaigns?limit=&offset=` | Returns the 2025 response, unchanged (see below) | [`/api/v1/campaigns`](#get-apiv1campaigns) |
| `GET /api/graph/current` | `308 Permanent Redirect` to `/api/v1/timeline` (same response) | [`/api/v1/timeline`](#get-apiv1timeline) |
| `GET /api/graph/previous` | `308 Permanent Redirect` to `/api/v1/timeline/history` (same response) | [`/api/v1/timeline/history`](#get-apiv1timelinehistory) |

Browsers and most HTTP clients follow the redirects automatically (with curl, add `-L`).

**`/api/tiltify`** returns the fields it returned in 2025:

```ts
interface LegacySummary {
  date: string;
  event: { year: number; start: string; end: string };
  dollarConversionRate: number;
  raised: number;
  collections: { redeemed: number; total: number };
  donations: number;
  history: { year: number; event: { start: string; end: string }; total: { dollars: number; pounds: number }; donations: number; collections?: number; campaigns?: number }[];
  causes: { id: string; name: string; logo: string; description: string; color: string; url: string; donateUrl: string; raised: number; campaigns: number }[];
  campaigns: { count: number; list: LegacyCampaign[] };   // Top 100
}

interface LegacyCampaign {
  causeId: string | null;
  name: string;
  description: string;
  id: string;
  slug: string;
  url: string;
  startTime: string | null;
  raised: number;
  goal: number;
  type: 'campaign' | 'team_event';
  team: { name: string; slug: string; avatar: string; url: string } | null;
  user: { name: string; slug: string; avatar: string; url: string };
}
```

**`/api/campaigns`** returns `{ campaigns: LegacyCampaign[], total, limit, offset }`. It takes `limit` (`1`–`100`, default `100`) and `offset`, and no other parameters.

**Moving to v1:**

| 2025 | v1 |
|---|---|
| `date` | `meta.updatedAt` |
| `event.year`, `event.start`, `event.end` | `meta.event.year`, `meta.event.startsAt`, `meta.event.endsAt` |
| `dollarConversionRate` | `meta.dollarConversionRate` |
| `history[].event.start`, `history[].event.end` | `history[].event.startsAt`, `history[].event.endsAt` |
| `causes[].logo` (the square logo) | `causes[].borderedLogo` (`logo` is now the bare logo) |
| `campaigns.count` | `campaigns.total` |
| campaign `causeId` | campaign `cause.id` (alongside the cause's `slug`, `name` and `color`) |
| campaign `startTime` | Removed |
| `campaigns.list` (top 100) | `campaigns.items` (top 25 in `/api/v1/event`; page through [`/api/v1/campaigns`](#get-apiv1campaigns) for more) |
| `/api/campaigns`: `campaigns`, `total`, `limit`, `offset` | `/api/v1/campaigns`: `campaigns.items`, `campaigns.total`, `campaigns.limit`, `campaigns.offset` |

---

## Admin endpoints

> [!CAUTION]
> These endpoints are for the tracker's maintainers. They need the secret admin token and overwrite live data.

Both endpoints need an `Authorization` header set to the admin token, either as is or as `Bearer <token>`. A missing or wrong token returns `401` with `{"error": "Unauthorized."}`. A successful call returns `200` with `{"success": true}`.

| Endpoint | Body | Effect |
|---|---|---|
| `POST /api/v1/event` | An edited [`/api/v1/event`](#get-apiv1event) response, or a summary in the Worker's internal format (the `ApiResponse` type in [ApiResponse.ts](../workers/tiltify-cache/src/types/ApiResponse.ts)) | Replaces the cached summary. An edited event response replaces the cached top campaigns with its 25 `campaigns.items`. It is replaced again at the next refresh, if refreshing is on. |
| `POST /api/v1/timeline` | An array of [timeline points](#get-apiv1timeline) | Replaces this year's timeline. Send `[]` to clear it. |

```bash
# Replace the summary with an edited copy of the event
curl -s https://dashboard.jinglejam.co.uk/api/v1/event > event.json
# ...edit event.json...
curl -X POST https://dashboard.jinglejam.co.uk/api/v1/event \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @event.json

# Clear the timeline at the start of a new year
curl -X POST https://dashboard.jinglejam.co.uk/api/v1/timeline \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[]'
```

`POST /api/tiltify` and `POST /api/summary` no longer work. `POST /api/graph/current` still works until the 2027 event, because its `308` redirect keeps the method and body.

See [Local Development → Admin token](LOCAL-DEVELOPMENT.md#admin-token) for how the token is set.
