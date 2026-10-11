import { Env } from "tiltify-cache/types/env";
import {
    EVENT_API_PATH,
    CAMPAIGNS_API_PATH,
    CAMPAIGN_API_PATH,
    CAUSES_API_PATH,
    CAUSE_API_PATH,
    LEGACY_SUMMARY_API_PATH,
    LEGACY_CAMPAIGNS_API_PATH,
    SNAPSHOT_INTERVAL_MS,
    IDLE_REFRESH_TIME,
    EVENT_WINDOW_PADDING_MS
} from "tiltify-cache/constants";
import { ApiResponse } from "tiltify-cache/types/ApiResponse";
import { errorResponse, getCacheKey, jsonResponse, Router } from "tiltify-cache/utils";
import { searchCampaigns } from "tiltify-cache/utils/search";
import { Campaign } from "tiltify-cache/types/Campaign";
import { CampaignStorageService } from "tiltify-cache/services/campaignStorage";
import { createDataSource } from "tiltify-cache/services/dataSource";
import { DataSource } from "tiltify-cache/types/DataSource";
import {
    EventResponse,
    getCampaign,
    getCampaignCollection,
    getCause,
    getCauseSlug,
    getEventResponse,
    getLegacyCampaign,
    getLegacySummary,
    getMeta,
    getSummaryFromEventResponse
} from "tiltify-cache/responses";

const MAIN_CAMPAIGN_LIMIT = 100; // Number of campaigns included in the main cached response
const CAMPAIGN_DEFAULT_LIMIT = 25; // Default number of campaigns in a page of the campaign list
const CAMPAIGN_MAX_LIMIT = 100; // Maximum number of campaigns in a page of the campaign list
const CAMPAIGN_TYPES = ['campaign', 'team_event']; // Values accepted by the campaign list's type filter
const SEARCH_MAX_LENGTH = 100; // Maximum length of the campaign list's search text
const CAUSE_CAMPAIGN_DEFAULT_LIMIT = 25; // Default number of top campaigns included in a cause response
const CAUSE_CAMPAIGN_MAX_LIMIT = 100; // Maximum number of top campaigns included in a cause response
const LEGACY_CAMPAIGN_DEFAULT_LIMIT = 100; // Default page size of the 2025 campaign list

/*
  Tiltify Data Durable Object

  The live data is held in memory and refreshed by an alarm, so API requests never touch storage.
  Snapshots are persisted at most every SNAPSHOT_INTERVAL_MS:
    - The main response (top campaigns) goes to Durable Object storage, so its fetch date stays current after a cold start
    - The full campaign list goes to a single KV value, only when it has changed
  Snapshots are only read after a cold start, until the first refresh completes.

  The summary is kept in its internal format and turned into each response's shape by tiltify-cache/responses.
  Single campaigns and team events add live data fetched from Tiltify on request, cached briefly by FactDetailsService.

  The data comes from a DataSource: Tiltify, or generated demo data when DEMO_MODE is set (tiltify-cache/demo).
  Demo data always refreshes, and is never persisted or restored, so it never replaces the stored Tiltify data.
*/
export class TiltifyData {
    storage: DurableObjectStorage;
    env: Env;
    private router: Router;
    private campaignStorage: CampaignStorageService;
    private source: DataSource;

    private summary: ApiResponse | null = null;             // Totals, causes, history and top campaigns, in the internal format
    private campaigns: Campaign[] | null = null;            // Full sorted campaign list served by the Campaigns API path
    private refreshing: Promise<void> | null = null;        // In-flight refresh, shared by concurrent callers
    private alarmChecked = false;
    private lastSnapshot = 0;
    private campaignsHash: string | null = null;

    constructor(state: DurableObjectState, env: Env) {
        this.storage = state.storage;
        this.env = env;
        this.campaignStorage = new CampaignStorageService(env.JINGLE_JAM_DATA, env.YEAR);
        this.source = createDataSource(env);
        this.router = this.setupRouter();

        state.blockConcurrencyWhile(async () => {
            if (!this.source.demo) {
                this.summary = await this.storage.get<ApiResponse>(getCacheKey(this.env.YEAR)) || null;
            }

            try {
                await CampaignStorageService.deleteLegacyChunks(this.storage);
            } catch (e) {
                console.error('Failed to delete legacy campaign chunks', e);
            }
        });
    }

    private setupRouter(): Router {
        const router = new Router();

        // GET route: Get the event (totals, causes, history and top campaigns)
        router.get(EVENT_API_PATH, async (request, url) => {
            console.log('Called ' + url.pathname);

            return jsonResponse(getEventResponse(await this.getSummary()));
        });

        // GET route: Get the paginated campaign list, optionally filtered by type and cause and searched by text
        router.get(CAMPAIGNS_API_PATH, async (request, url) => {
            console.log('Called ' + url.pathname);

            const paging = getPaging(url, CAMPAIGN_DEFAULT_LIMIT, CAMPAIGN_MAX_LIMIT);
            if (paging instanceof Response) {
                return paging;
            }

            const typeParam = url.searchParams.get('type');
            const causeParam = (url.searchParams.get('cause') || '').trim().toLowerCase();
            const search = (url.searchParams.get('search') || '').trim();

            const types = typeParam ? typeParam.split(',').map(type => type.trim().toLowerCase()) : null;
            if (types && types.some(type => !CAMPAIGN_TYPES.includes(type))) {
                return errorResponse(`Invalid type parameter. Type must be one or more of ${CAMPAIGN_TYPES.join(', ')}, separated by commas.`, 400);
            }

            if (search.length > SEARCH_MAX_LENGTH) {
                return errorResponse(`Invalid search parameter. Search must be at most ${SEARCH_MAX_LENGTH} characters.`, 400);
            }

            const summary = await this.getSummary();
            const cause = causeParam ? summary.causes.find(c => getCauseSlug(c) === causeParam || c.id.toLowerCase() === causeParam) : null;
            if (causeParam && !cause) {
                return errorResponse(`Invalid cause parameter. Cause must be the slug or id of a cause from ${CAUSES_API_PATH}.`, 400);
            }

            let campaigns = await this.getCampaignList();
            if (types) {
                campaigns = campaigns.filter(campaign => types.includes(campaign.type));
            }
            if (cause) {
                campaigns = campaigns.filter(campaign => campaign.causeId === cause.id);
            }
            if (search) {
                campaigns = searchCampaigns(campaigns, search);
            }

            return jsonResponse({
                meta: getMeta(summary),
                campaigns: getCampaignCollection(campaigns, summary.causes, paging.limit, paging.offset)
            });
        });

        // GET route: Get a single campaign or team event by id, with live data from Tiltify (and a team event's supporting campaigns)
        router.get(CAMPAIGN_API_PATH, async (request, url, params) => {
            console.log('Called ' + url.pathname);

            const summary = await this.getSummary();
            const campaign = await this.findCampaign(params.campaign);

            if (!campaign) {
                return errorResponse('Campaign not found.', 404);
            }

            const isTeamEvent = campaign.type === 'team_event';
            const [details, allCampaigns] = await Promise.all([
                this.source.getFactDetails(campaign.id),
                isTeamEvent ? this.getCampaignList() : Promise.resolve([])
            ]);

            const response = {
                meta: getMeta(summary),
                campaign: getCampaign(campaign, summary.causes),
                social: details.social,
                donationMatches: details.donationMatches,
                rewards: details.rewards,
                topDonors: details.topDonors,
                latestDonations: details.latestDonations
            };

            if (!isTeamEvent) {
                return jsonResponse(response);
            }

            // Every supporting campaign is included in one page
            const supportingCampaigns = allCampaigns.filter(c => c.teamEvent?.id === campaign.id);
            return jsonResponse({
                ...response,
                teamMemberCount: details.teamMemberCount,
                campaigns: getCampaignCollection(supportingCampaigns, summary.causes, supportingCampaigns.length)
            });
        });

        // GET route: Get every cause with the amount raised for it
        router.get(CAUSES_API_PATH, async (request, url) => {
            console.log('Called ' + url.pathname);

            const summary = await this.getSummary();

            return jsonResponse({
                meta: getMeta(summary),
                causes: summary.causes.map(getCause)
            });
        });

        // GET route: Get a single cause and its top campaigns, looked up by slug or id
        router.get(CAUSE_API_PATH, async (request, url, params) => {
            console.log('Called ' + url.pathname);

            const paging = getPaging(url, CAUSE_CAMPAIGN_DEFAULT_LIMIT, CAUSE_CAMPAIGN_MAX_LIMIT);
            if (paging instanceof Response) {
                return paging;
            }

            const summary = await this.getSummary();
            const causeKey = params.cause.toLowerCase();
            const cause = summary.causes.find(c => getCauseSlug(c) === causeKey || c.id.toLowerCase() === causeKey);

            if (!cause) {
                return errorResponse('Cause not found.', 404);
            }

            // Campaigns dedicated to this cause (already sorted by amount raised)
            const causeCampaigns = (await this.getCampaignList()).filter(campaign => campaign.causeId === cause.id);

            return jsonResponse({
                meta: getMeta(summary),
                cause: getCause(cause),
                campaigns: getCampaignCollection(causeCampaigns, summary.causes, paging.limit, paging.offset)
            });
        });

        // POST route: Manually replace the cached summary, sent as an event response or in the internal format
        router.post(
            EVENT_API_PATH,
            async (request, url) => {
                console.log('Called ' + url.pathname);

                const body: ApiResponse | EventResponse = await request.json();
                const data = 'meta' in body ? getSummaryFromEventResponse(body, this.campaigns || []) : body;
                this.summary = data;
                await this.storage.put(getCacheKey(this.env.YEAR), data);
                return jsonResponse({ success: true });
            },
            {
                requiresAuth: true,
                authToken: this.env.ADMIN_TOKEN,
            }
        );

        // GET route: The 2025 summary response, kept until the 2027 event
        router.get(LEGACY_SUMMARY_API_PATH, async (request, url) => {
            console.log('Called ' + url.pathname);

            return jsonResponse(getLegacySummary(await this.getSummary()));
        });

        // GET route: The 2025 paginated campaign list (no search or filters), kept until the 2027 event
        router.get(LEGACY_CAMPAIGNS_API_PATH, async (request, url) => {
            console.log('Called ' + url.pathname);

            const paging = getPaging(url, LEGACY_CAMPAIGN_DEFAULT_LIMIT, CAMPAIGN_MAX_LIMIT);
            if (paging instanceof Response) {
                return paging;
            }

            await this.getSummary();
            const campaigns = await this.getCampaignList();

            return jsonResponse({
                campaigns: campaigns.slice(paging.offset, paging.offset + paging.limit).map(getLegacyCampaign),
                total: campaigns.length,
                limit: paging.limit,
                offset: paging.offset
            });
        });

        return router;
    }

    // Handle HTTP requests from clients.
    async fetch(request: Request): Promise<Response> {
        return this.router.handle(request);
    }

    // Get the summary, fetching the latest data first if there is none yet (first load), and start the alarm if needed
    private async getSummary(): Promise<ApiResponse> {
        await this.ensureAlarm();

        if (!this.summary) {
            await this.refresh();
        }

        if (!this.summary) {
            throw new Error('No summary data available');
        }
        return this.summary;
    }

    // Find a fundraiser in this year's campaign list by id (not case-sensitive)
    private async findCampaign(id: string): Promise<Campaign | undefined> {
        const key = id.toLowerCase();
        return (await this.getCampaignList()).find(campaign => campaign.id.toLowerCase() === key);
    }

    // Get the full sorted campaign list, serving the KV snapshot after a cold start until the next refresh, or fetching if there is none
    private async getCampaignList(): Promise<Campaign[]> {
        if (!this.campaigns && !this.source.demo) {
            const snapshot = await this.campaignStorage.getCampaigns();
            if (!this.campaigns && snapshot.length > 0) {
                this.campaigns = snapshot;
            }
        }
        if (!this.campaigns) {
            await this.refresh();
        }

        return this.campaigns || [];
    }

    async alarm(): Promise<void> {
        // Schedule the next alarm first so a failed refresh doesn't stop the loop
        this.scheduleNextAlarm();

        console.log('Alarm Called, fetching latest Tiltify data...');

        const startTime = new Date();
        await this.refresh();

        console.log(`Finished refreshing Tiltify data... (${new Date().getTime() - startTime.getTime()}ms)`);
    }

    // Start the alarm if it is currently not started (checked once per instance)
    private async ensureAlarm(): Promise<void> {
        if (this.alarmChecked) {
            return;
        }
        this.alarmChecked = true;

        const currentAlarm = await this.storage.getAlarm();
        if (currentAlarm == null) {
            this.scheduleNextAlarm();
        }
    }

    // Refresh every LIVE_REFRESH_TIME seconds during the event window, and every IDLE_REFRESH_TIME seconds outside it
    private scheduleNextAlarm(): void {
        if (!this.env.ENABLE_REFRESH && !this.source.demo) {
            return;
        }

        let refreshTime = this.env.LIVE_REFRESH_TIME;
        if (this.summary) {
            const now = Date.now();
            const start = new Date(this.summary.event.start).getTime() - EVENT_WINDOW_PADDING_MS;
            const end = new Date(this.summary.event.end).getTime() + EVENT_WINDOW_PADDING_MS;
            if (now < start || now > end) {
                refreshTime = IDLE_REFRESH_TIME;
            }
        }

        this.storage.setAlarm(Date.now() + (refreshTime * 1000));
    }

    // Fetch the latest data into memory, sharing a single in-flight fetch between concurrent callers
    private refresh(): Promise<void> {
        if (!this.refreshing) {
            this.refreshing = this.fetchLatestData().finally(() => {
                this.refreshing = null;
            });
        }
        return this.refreshing;
    }

    private async fetchLatestData(): Promise<void> {
        const newData = await this.source.getLatestData();
        const checkFailures = !this.source.demo;    // A demo that starts again legitimately goes back to nothing raised

        // Keep the current data if the raised amount is not valid
        if (!newData || (checkFailures && this.summary && newData.raised === 0 && this.summary.raised !== 0)) {
            console.log(`Raised amount invalid... Keeping old data`);
            return;
        }

        // Check if the campaigns failed to load, if so, keep the old campaigns
        if (checkFailures && this.summary && newData.campaigns.count === 0 && this.summary.campaigns.count > 0) {
            console.log(`Campaigns failed to load... Keeping old data`);

            newData.campaigns = this.summary.campaigns;
            newData.causes = this.summary.causes;
        } else {
            this.campaigns = newData.campaigns.list;

            // Truncate the campaigns list for the main cache
            newData.campaigns.list = newData.campaigns.list.slice(0, MAIN_CAMPAIGN_LIMIT);
        }

        this.summary = newData;

        try {
            await this.persistSnapshots();
        } catch (e) {
            console.error('Failed to persist snapshots', e);
        }
    }

    // Persist the in-memory data for cold starts, at most every SNAPSHOT_INTERVAL_MS
    private async persistSnapshots(): Promise<void> {
        const now = Date.now();
        if (this.source.demo || now - this.lastSnapshot < SNAPSHOT_INTERVAL_MS) {
            return;
        }
        this.lastSnapshot = now;

        if (this.summary) {
            await this.storage.put(getCacheKey(this.env.YEAR), this.summary);
        }

        if (this.campaigns && this.campaigns.length > 0) {
            const campaignsHash = await hash(this.campaigns);
            if (campaignsHash !== this.campaignsHash) {
                await this.campaignStorage.storeCampaigns(this.campaigns);
                this.campaignsHash = campaignsHash;
            }
        }
    }
}

// Read and validate the limit and offset query parameters, or return a 400 response
function getPaging(url: URL, defaultLimit: number, maxLimit: number): { limit: number; offset: number } | Response {
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');

    const limit = limitParam !== null ? parseInt(limitParam, 10) : defaultLimit;
    if (isNaN(limit) || limit < 1 || limit > maxLimit) {
        return errorResponse(`Invalid limit parameter. Limit must be between 1 and ${maxLimit}.`, 400);
    }

    const offset = offsetParam !== null ? parseInt(offsetParam, 10) : 0;
    if (isNaN(offset) || offset < 0) {
        return errorResponse('Invalid offset parameter. Offset must be a positive number (0 or greater).', 400);
    }

    return { limit, offset };
}

async function hash(value: unknown): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
