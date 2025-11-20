# Jingle Jam Tracker API Documentation

## Base URL

- **Production:** `https://dashboard.jinglejam.co.uk`
- **Development:** `https://develop.jingle-jam-tracker.pages.dev`
- **Local:** `http://127.0.0.1:8788`

> **Note:** The `Development` API includes previous years' data for testing purposes.

## Overview

The Jingle Jam Tracker API provides real-time and historical donation data for the Jingle Jam charity event. All endpoints return JSON data and support CORS for cross-origin requests.

## Endpoints

### 1. GET /api/tiltify

Returns real-time Jingle Jam donation data for the current year.

#### Request

```http
GET /api/tiltify
```

#### Response

**Status Code:** `200 OK`

**Content-Type:** `application/json;charset=UTF-8`

**Response Body:**

```typescript
{
  date: string;                    // Last API Refresh as an ISO 8601 date string
  event: {
    year: number;                  // Event year (e.g., 2025)
    start: string;                 // ISO 8601 date string
    end: string;                   // ISO 8601 date string
  };
  dollarConversionRate: number;    // Current GBP to USD conversion rate
  raised: number;                  // Total amount raised in pounds
  collections: {
    redeemed: number;              // Number of collections redeemed
    total: number;                 // Total number of collections available
  };
  donations: number;               // Total number of donations
  history: DonationHistory[];      // Historical donation data by year
  causes: Cause[];                 // List of causes with raised amounts
  campaigns: {
    count: number;                 // Total number of campaigns
    list: Campaign[];              // Top 100 campaigns (sorted by raised amount)
  };
}
```

#### Response Types

**DonationHistory:**
```typescript
{
  year: number;                    // Event year
  event: {
    start: string;                 // Starting date for the event as an ISO 8601 date string
    end: string;                   // Ending date for the event as an ISO 8601 date string
  }
  total: {
    dollars: number;               // Total amount raised this year in dollars
    pounds: number;                // Total amount raised this year in pounds
  };
  donations: number;               // Total number of donations this year
  collections?: number;            // Total number of collections redeemed this year (optional, 2020 and later)
  campaigns?: number;              // Total number of Tiltify campaigns this year (optional, 2021 and later)
}
```

**Cause:**
```typescript
{
  id: string;                     // Tiltify UUID representing the cause
  name: string;                   // Name of the cause
  logo: string;                   // URL to cause logo
  description: string;            // Description explaining the cause
  color: string;                  // Hex color code
  url: string;                    // URL to the causes official website
  donateUrl: string;              // URL to a list of campaigns supporting that cause
  raised: number;                 // Amount raised for this cause in pounds
  campaigns: number;              // Number of campaigns for this cause
}
```

**Campaign:**
```typescript
{
  causeId: string | null;         // Associated cause ID, or null (null means supporting all causes)
  name: string;                   // Campaign name
  description: string;            // Campaign description (limited to 1024 characters)
  id: string;                     // Tiltify UUID representing the campaign
  slug: string;                   // Tiltify slug representing the campaign
  url: string;                    // URL to campaign page
  startTime: string | null;       // Campaign start date in ISO 8601 date string, or null
  raised: number;                 // Amount raised in pounds
  goal: number;                   // Campaign goal in pounds
  type: string;                   // 'campaign' or 'team_event'
  team: {                         // (Optional) team object if the campaign is part of a team
    name: string;                 // Team name
    slug: string;                 // Tiltify slug representing the team
    avatar: string;               // URL to team avatar
    url: string;                  // URL link to the team
  } | null;                       // Team information, or null
  user: {
    name: string;                 // User name
    slug: string;                 // Tiltify slug representing the user
    avatar: string;               // URL to user avatar
    url: string;                  // URL to the user page
  };
}
```

#### Refresh Rate

Data is automatically refreshed every **10 seconds**.

#### Example Request

```bash
curl https://dashboard.jinglejam.co.uk/api/tiltify
```

#### Example Response

```json
{
  "date": "2025-12-01T12:00:00.000Z",
  "event": {
    "year": 2025,
    "start": "2025-12-01T17:00:00.000Z",
    "end": "2025-12-31T23:59:59.000Z"
  },
  "dollarConversionRate": 1.25,
  "raised": 1000000.50,
  "collections": {
    "redeemed": 5000,
    "total": 10000
  },
  "donations": 15000,
  "history": [
    {
      "year": 2024,
      "total": {
        "dollars": 5000000,
        "pounds": 4000000
      },
      "donations": 50000
    }
  ],
  "causes": [
    {
      "id": "cause-1",
      "name": "Example Cause",
      "logo": "https://example.com/logo.png",
      "description": "A great cause",
      "color": "#FF5733",
      "url": "https://example.com/cause",
      "donateUrl": "https://example.com/donate",
      "raised": 100000,
      "campaigns": 10
    }
  ],
  "campaigns": {
    "count": 150,
    "list": [
      {
        "causeId": "cause-1",
        "name": "Example Campaign",
        "description": "Campaign description",
        "id": "campaign-1",
        "slug": "example-campaign",
        "url": "https://example.com/campaign",
        "startTime": "2025-12-01T17:00:00.000Z",
        "raised": 50000,
        "goal": 100000,
        "type": "campaign",
        "team": null,
        "user": {
          "name": "John Doe",
          "slug": "johndoe",
          "avatar": "https://example.com/avatar.png",
          "url": "https://example.com/user"
        }
      }
    ]
  }
}
```

---

### 2. GET /api/graph/current

Returns time-series data points tracking the amount raised over time for the current year. Data points are added every 10 minutes during the event.

#### Request

```http
GET /api/graph/current
```

#### Response

**Status Code:** `200 OK`

**Content-Type:** `application/json;charset=UTF-8`

**Response Body:**

An array of graph data points:

```typescript
CurrentGraphPoint[]
```

**CurrentGraphPoint:**
```typescript
{
  date: number;    // Unix timestamp in milliseconds
  p: number;       // Amount raised in pounds
  d: number;       // Amount raised in dollars
}
```

#### Data Point Frequency

- Data points are automatically added every **10 minutes** during the event
- The first data point is created at the event start time with a value of 0

#### Example Request

```bash
curl https://dashboard.jinglejam.co.uk/api/graph/current
```

#### Example Response

```json
[
  {
    "date": 1733068800000,
    "p": 0,
    "d": 0
  },
  {
    "date": 1733069400000,
    "p": 50000.25,
    "d": 62500.31
  },
  {
    "date": 1733070000000,
    "p": 100000.50,
    "d": 125000.63
  }
]
```

---

### 3. GET /api/graph/previous

Returns historical time-series data points for previous years (going back to 2016). This data is used for plotting historical trends on graphs.

#### Request

```http
GET /api/graph/previous
```

#### Response

**Status Code:** `200 OK`

**Content-Type:** `application/json;charset=UTF-8`

**Response Body:**

An array of historical graph data points:

```typescript
PreviousGraphPoint[]
```

**PreviousGraphPoint:**
```typescript
{
  timestamp: string;        // ISO 8601 date string
  year: number;             // Event year (e.g., 2016, 2017, etc.)
  amountDollars: number;    // Amount raised in dollars at this point
  amountPounds: number;     // Amount raised in pounds at this point
}
```

#### Data Coverage

- Historical data spans from **2016** to the previous year
- Data points are stored at various intervals depending on the year

#### Example Request

```bash
curl https://dashboard.jinglejam.co.uk/api/graph/previous
```

#### Example Response

```json
[
  {
    "timestamp": "2016-12-01T17:00:00",
    "year": 2016,
    "amountDollars": 0,
    "amountPounds": 0
  },
  {
    "timestamp": "2016-12-01T17:20:00",
    "year": 2016,
    "amountDollars": 38483.86,
    "amountPounds": 30584.66
  },
  {
    "timestamp": "2017-12-01T17:00:00",
    "year": 2017,
    "amountDollars": 0,
    "amountPounds": 0
  }
]
```

---

## Error Responses

All endpoints may return the following error responses:

### 404 Not Found

Returned when an invalid endpoint is accessed.

**Response:**
```json
"Not found"
```

### 500 Internal Server Error

Returned when an internal server error occurs.

---

## CORS

All endpoints support Cross-Origin Resource Sharing (CORS) with the following headers:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, HEAD, POST, OPTIONS`
- `Access-Control-Max-Age: 86400`

---

## Admin Endpoints

The API also provides admin-only endpoints for manually managing cached data. These require authentication via an `Authorization` header with an admin token.

### POST /api/tiltify

Manually update the cached Tiltify donation data.

**Headers:**
- `Authorization: <admin-token>`
- `Content-Type: application/json`

**Request Body:** JSON object matching the `ApiResponse` structure

**Response:**
- `200 OK` - "Manual Update Success"
- `401 Unauthorized` - Invalid or missing admin token

### POST /api/graph/current

Manually update the cached current year graph data.

**Headers:**
- `Authorization: <admin-token>`
- `Content-Type: application/json`

**Request Body:** Array of `CurrentGraphPoint` objects

**Response:**
- `200 OK` - "Manual Update Success"
- `401 Unauthorized` - Invalid or missing admin token

---

## Notes

- All monetary amounts are in **pounds (GBP)** unless otherwise specified
- Dollar amounts are calculated using the current conversion rate provided in the `/api/tiltify` endpoint
- Timestamps use Unix milliseconds for `/api/graph/current` and ISO 8601 strings for `/api/graph/previous`
- The `/api/tiltify` endpoint returns the top 100 campaigns sorted by amount raised
- Historical data in `/api/graph/previous` may have varying data point frequencies depending on the year

