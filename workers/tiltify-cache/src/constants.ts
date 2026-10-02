const GRAPH_API_PATH = '/api/graph/current'; // API Path for the Graph Data
const SUMMARY_API_PATH = '/api/summary'; // API Path for the event summary (the old /api/tiltify path redirects here)
const CAMPAIGNS_API_PATH = '/api/campaigns'; // API Path for the paginated and searchable campaign list
const CAMPAIGN_API_PATH = '/api/campaigns/:campaign'; // API Path for a single campaign or team campaign (by id), with live Tiltify data
const TEAM_EVENT_API_PATH = '/api/team_events/:teamEvent'; // API Path for a single team event (by id), with live Tiltify data
const CAUSES_API_PATH = '/api/causes'; // API Path for the list of causes
const CAUSE_API_PATH = '/api/causes/:cause'; // API Path for a single cause's summary (by slug or id)

// Details for the event-level (all causes) view served by the cause API path at the CAUSE_SLUG env var
const EVENT_NAME = 'Jingle Jam';
const EVENT_COLOR = '#e21251';
const EVENT_WEBSITE_URL = 'https://www.jinglejam.co.uk';
const EVENT_LOGO_PATH = '/assets/jingle-jam-2026-logo.webp';

const SNAPSHOT_INTERVAL_MS = 60 * 1000; // Minimum time between persisted snapshots of the live data (KV reads are cached for ~60s)
const IDLE_REFRESH_TIME = 5 * 60; // Refresh interval (seconds) outside the event window
const EVENT_WINDOW_PADDING_MS = 24 * 60 * 60 * 1000; // Live refreshing starts/stops this long before/after the event
const FACT_DETAILS_TTL_MS = 30 * 1000; // How long the live Tiltify data for a single campaign or team event is reused
const TOP_DONOR_LIMIT = 25; // Number of top donors included for a single campaign or team event
const LATEST_DONATION_LIMIT = 25; // Number of latest donations included for a single campaign or team event

export {
    SUMMARY_API_PATH,
    GRAPH_API_PATH,
    CAMPAIGNS_API_PATH,
    CAMPAIGN_API_PATH,
    TEAM_EVENT_API_PATH,
    CAUSES_API_PATH,
    CAUSE_API_PATH,
    EVENT_NAME,
    EVENT_COLOR,
    EVENT_WEBSITE_URL,
    EVENT_LOGO_PATH,
    SNAPSHOT_INTERVAL_MS,
    IDLE_REFRESH_TIME,
    EVENT_WINDOW_PADDING_MS,
    FACT_DETAILS_TTL_MS,
    TOP_DONOR_LIMIT,
    LATEST_DONATION_LIMIT
 };
