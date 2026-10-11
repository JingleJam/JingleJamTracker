const EVENT_API_PATH = '/api/v1/event'; // API Path for the event (totals, causes, history and top campaigns)
const CAMPAIGNS_API_PATH = '/api/v1/campaigns'; // API Path for the paginated and searchable campaign list
const CAMPAIGN_API_PATH = '/api/v1/campaigns/:campaign'; // API Path for a single campaign or team event (by id), with live Tiltify data
const CAUSES_API_PATH = '/api/v1/causes'; // API Path for the list of causes
const CAUSE_API_PATH = '/api/v1/causes/:cause'; // API Path for a single cause and its top campaigns (by slug or id)
const TIMELINE_API_PATH = '/api/v1/timeline'; // API Path for the current event's total over time

// Paths from the 2025 event, which keep serving their 2025 response shape until the 2027 event
const LEGACY_SUMMARY_API_PATH = '/api/tiltify';
const LEGACY_CAMPAIGNS_API_PATH = '/api/campaigns';

// The cause shown for a campaign that supports every cause
const ALL_CAUSES_NAME = 'All The Charities';
const ALL_CAUSES_COLOR = '#e21251'; // Jingle Jam pink

const SNAPSHOT_INTERVAL_MS = 60 * 1000; // Minimum time between persisted snapshots of the live data (KV reads are cached for ~60s)
const IDLE_REFRESH_TIME = 5 * 60; // Refresh interval (seconds) outside the event window
const EVENT_WINDOW_PADDING_MS = 24 * 60 * 60 * 1000; // Live refreshing starts/stops this long before/after the event
const FACT_DETAILS_TTL_MS = 30 * 1000; // How long the live Tiltify data for a single campaign or team event is reused
const TOP_DONOR_LIMIT = 25; // Number of top donors included for a single campaign or team event
const LATEST_DONATION_LIMIT = 25; // Number of latest donations included for a single campaign or team event

export {
    EVENT_API_PATH,
    CAMPAIGNS_API_PATH,
    CAMPAIGN_API_PATH,
    CAUSES_API_PATH,
    CAUSE_API_PATH,
    TIMELINE_API_PATH,
    LEGACY_SUMMARY_API_PATH,
    LEGACY_CAMPAIGNS_API_PATH,
    ALL_CAUSES_NAME,
    ALL_CAUSES_COLOR,
    SNAPSHOT_INTERVAL_MS,
    IDLE_REFRESH_TIME,
    EVENT_WINDOW_PADDING_MS,
    FACT_DETAILS_TTL_MS,
    TOP_DONOR_LIMIT,
    LATEST_DONATION_LIMIT
 };
