const GRAPH_API_PATH = '/api/graph/current'; // API Path for the Graph Data
const TILTIFY_API_PATH = '/api/tiltify'; // API Path for the Tiltify Cache
const CAMPAIGNS_API_PATH = '/api/campaigns'; // API Path for the Campaigns Data
const CAUSE_API_PATH = '/api/causes/:cause'; // API Path for a single cause's summary (by slug or id)

const SNAPSHOT_INTERVAL_MS = 60 * 1000; // Minimum time between persisted snapshots of the live data (KV reads are cached for ~60s)
const IDLE_REFRESH_TIME = 5 * 60; // Refresh interval (seconds) outside the event window
const EVENT_WINDOW_PADDING_MS = 24 * 60 * 60 * 1000; // Live refreshing starts/stops this long before/after the event

export {
    TILTIFY_API_PATH,
    GRAPH_API_PATH,
    CAMPAIGNS_API_PATH,
    CAUSE_API_PATH,
    SNAPSHOT_INTERVAL_MS,
    IDLE_REFRESH_TIME,
    EVENT_WINDOW_PADDING_MS
 };