import { Env } from "tiltify-cache/types/env";
import {
    SUMMARY_API_PATH,
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
    EVENT_WINDOW_PADDING_MS
} from "tiltify-cache/constants";
import { getLatestData } from "tiltify-cache/api";
import { ApiResponse } from "tiltify-cache/types/ApiResponse";
import { generateSlug, getCacheKey, roundAmount, Router } from "tiltify-cache/utils";
import { searchCampaigns } from "tiltify-cache/utils/search";
import { Campaign } from "tiltify-cache/types/Campaign";
import { Cause } from "tiltify-cache/types/Cause";
import { CampaignStorageService } from "tiltify-cache/services/campaignStorage";
import { FactDetailsService } from "tiltify-cache/services/factDetails";

const MAIN_CAMPAIGN_LIMIT = 100; // Number of campaigns included in the main cached response
const CAMPAIGN_DEFAULT_LIMIT = 20; // Default number of campaigns in a page of the campaign list
const CAMPAIGN_MAX_LIMIT = 100; // Maximum number of campaigns in a page of the campaign list
const CAMPAIGN_TYPES = ['campaign', 'team_campaign', 'team_event']; // Values accepted by the campaign list's type filter
const SEARCH_MAX_LENGTH = 100; // Maximum length of the campaign list's search text
const CAUSE_CAMPAIGN_DEFAULT_LIMIT = 10; // Default number of top campaigns included in a cause response
const CAUSE_CAMPAIGN_MAX_LIMIT = 100; // Maximum number of top campaigns included in a cause response

/*
  Tiltify Data Durable Object

  The live data is held in memory and refreshed by an alarm, so API requests never touch storage.
  Snapshots are persisted at most every SNAPSHOT_INTERVAL_MS:
    - The main response (top campaigns) goes to Durable Object storage, so its fetch date stays current after a cold start
    - The full campaign list goes to a single KV value, only when it has changed
  Snapshots are only read after a cold start, until the first refresh completes.

  Single campaigns and team events add live data fetched from Tiltify on request, cached briefly by FactDetailsService.
*/
export class TiltifyData {
    storage: DurableObjectStorage;
    env: Env;
    private router: Router;
    private campaignStorage: CampaignStorageService;
    private factDetails = new FactDetailsService();

    private summary: ApiResponse | null = null;             // Main response served by the Summary API path
    private campaigns: Campaign[] | null = null;            // Full sorted campaign list served by the Campaigns API path
    private refreshing: Promise<void> | null = null;        // In-flight refresh, shared by concurrent callers
    private alarmChecked = false;
    private lastSnapshot = 0;
    private campaignsHash: string | null = null;

    constructor(state: DurableObjectState, env: Env) {
        this.storage = state.storage;
        this.env = env;
        this.campaignStorage = new CampaignStorageService(env.JINGLE_JAM_DATA, env.YEAR);
        this.router = this.setupRouter();

        state.blockConcurrencyWhile(async () => {
            this.summary = await this.storage.get<ApiResponse>(getCacheKey(this.env.YEAR)) || null;

            try {
                await CampaignStorageService.deleteLegacyChunks(this.storage);
            } catch (e) {
                console.error('Failed to delete legacy campaign chunks', e);
            }
        });
    }

    private setupRouter(): Router {
        const router = new Router();

        // GET route: Get the event summary (totals, causes, history and top campaigns)
        router.get(SUMMARY_API_PATH, async (request, url) => {
            console.log('Called ' + url.pathname);

            return jsonResponse(await this.getSummary());
        });

        // GET route: Get the paginated campaign list, optionally filtered by type and searched by text
        router.get(CAMPAIGNS_API_PATH, async (request, url) => {
            console.log('Called ' + url.pathname);

            const limitParam = url.searchParams.get('limit');
            const offsetParam = url.searchParams.get('offset');
            const typeParam = url.searchParams.get('type');
            const search = (url.searchParams.get('search') || '').trim();

            const limit = limitParam !== null ? parseInt(limitParam, 10) : CAMPAIGN_DEFAULT_LIMIT;
            if (isNaN(limit) || limit < 1 || limit > CAMPAIGN_MAX_LIMIT) {
                return errorResponse(`Invalid limit parameter. Limit must be between 1 and ${CAMPAIGN_MAX_LIMIT}.`, 400);
            }

            const offset = offsetParam !== null ? parseInt(offsetParam, 10) : 0;
            if (isNaN(offset) || offset < 0) {
                return errorResponse('Invalid offset parameter. Offset must be a positive number (0 or greater).', 400);
            }

            const types = typeParam ? typeParam.split(',').map(type => type.trim().toLowerCase()) : null;
            if (types && types.some(type => !CAMPAIGN_TYPES.includes(type))) {
                return errorResponse(`Invalid type parameter. Type must be one or more of ${CAMPAIGN_TYPES.join(', ')}, separated by commas.`, 400);
            }

            if (search.length > SEARCH_MAX_LENGTH) {
                return errorResponse(`Invalid search parameter. Search must be at most ${SEARCH_MAX_LENGTH} characters.`, 400);
            }

            const summary = await this.getSummary();
            let campaigns = await this.getCampaignList();
            if (types) {
                campaigns = campaigns.filter(campaign => types.includes(getCampaignType(campaign)));
            }
            if (search) {
                campaigns = searchCampaigns(campaigns, search);
            }

            return jsonResponse({
                ...getEnvelope(summary),
                campaigns: campaigns.slice(offset, offset + limit),
                total: campaigns.length,
                limit,
                offset
            });
        });

        // GET route: Get a single campaign or team campaign by id, with live data from Tiltify
        router.get(CAMPAIGN_API_PATH, async (request, url, params) => {
            console.log('Called ' + url.pathname);

            const summary = await this.getSummary();
            const campaign = await this.findCampaign(params.campaign);

            if (!campaign || campaign.type !== 'campaign') {
                return errorResponse(campaign?.type === 'team_event'
                    ? `Campaign not found. This ID is a team event, use ${TEAM_EVENT_API_PATH.replace(':teamEvent', campaign.id)}.`
                    : 'Campaign not found.', 404);
            }

            const details = await this.factDetails.get(campaign.id);

            return jsonResponse({
                ...getEnvelope(summary),
                campaign,
                social: details.social,
                donationMatches: details.donationMatches,
                rewards: details.rewards,
                topDonors: details.topDonors,
                latestDonations: details.latestDonations
            });
        });

        // GET route: Get a single team event by id and its supporting campaigns, with live data from Tiltify
        router.get(TEAM_EVENT_API_PATH, async (request, url, params) => {
            console.log('Called ' + url.pathname);

            const summary = await this.getSummary();
            const teamEvent = await this.findCampaign(params.teamEvent);

            if (!teamEvent || teamEvent.type !== 'team_event') {
                return errorResponse(teamEvent?.type === 'campaign'
                    ? `Team event not found. This ID is a campaign, use ${CAMPAIGN_API_PATH.replace(':campaign', teamEvent.id)}.`
                    : 'Team event not found.', 404);
            }

            const [details, allCampaigns] = await Promise.all([
                this.factDetails.get(teamEvent.id),
                this.getCampaignList()
            ]);
            const supportingCampaigns = allCampaigns.filter(campaign => campaign.teamEvent?.id === teamEvent.id);

            return jsonResponse({
                ...getEnvelope(summary),
                teamEvent,
                teamMemberCount: details.teamMemberCount,
                social: details.social,
                donationMatches: details.donationMatches,
                rewards: details.rewards,
                topDonors: details.topDonors,
                latestDonations: details.latestDonations,
                campaigns: {
                    count: supportingCampaigns.length,
                    live: supportingCampaigns.filter(campaign => campaign.live).length,
                    list: supportingCampaigns
                }
            });
        });

        // GET route: Get every cause with the amount raised for it
        router.get(CAUSES_API_PATH, async (request, url) => {
            console.log('Called ' + url.pathname);

            const summary = await this.getSummary();

            return jsonResponse({
                ...getEnvelope(summary),
                causes: summary.causes.map(cause => ({ ...cause, slug: getCauseSlug(cause) }))
            });
        });

        // GET route: Get the summary and top campaigns for a single cause, looked up by slug or id
        // The CAUSE_SLUG env var returns the same summary for the whole event (every cause)
        router.get(CAUSE_API_PATH, async (request, url, params) => {
            console.log('Called ' + url.pathname);

            // Validate limit parameter
            const limitParam = url.searchParams.get('limit');
            const limit = limitParam !== null ? parseInt(limitParam, 10) : CAUSE_CAMPAIGN_DEFAULT_LIMIT;
            if (isNaN(limit) || limit < 1 || limit > CAUSE_CAMPAIGN_MAX_LIMIT) {
                return errorResponse(`Invalid limit parameter. Limit must be between 1 and ${CAUSE_CAMPAIGN_MAX_LIMIT}.`, 400);
            }

            const summary = await this.getSummary();
            const causeKey = params.cause.toLowerCase();
            const isEvent = causeKey === this.env.CAUSE_SLUG.toLowerCase();
            const cause = isEvent
                ? getEventCause(summary, this.env, url)
                : summary.causes.find(c => getCauseSlug(c) === causeKey || c.id.toLowerCase() === causeKey);

            if (!cause) {
                return errorResponse('Cause not found.', 404);
            }

            // Campaigns dedicated to this cause, or every campaign for the event (already sorted by amount raised)
            const allCampaigns = await this.getCampaignList();
            const causeCampaigns = isEvent ? allCampaigns : allCampaigns.filter(campaign => campaign.causeId === cause.id);

            return jsonResponse({
                ...getEnvelope(summary),
                raised: summary.raised,
                scope: isEvent ? 'event' : 'cause',
                cause: { ...cause, slug: getCauseSlug(cause) },
                campaigns: {
                    count: causeCampaigns.length,
                    live: causeCampaigns.filter(campaign => campaign.live).length,
                    matching: causeCampaigns.filter(campaign => campaign.donationMatchMultiplier > 1).length,
                    list: causeCampaigns.slice(0, limit)
                }
            });
        });

        // POST route: Manually update the current cached summary
        router.post(
            SUMMARY_API_PATH,
            async (request, url) => {
                console.log('Called ' + url.pathname);

                const data: ApiResponse = await request.json();
                this.summary = data;
                await this.storage.put(getCacheKey(this.env.YEAR), data);
                return new Response("Manual Update Success", { status: 200 });
            },
            {
                requiresAuth: true,
                authToken: this.env.ADMIN_TOKEN,
            }
        );

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
        if (!this.campaigns) {
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
        if (!this.env.ENABLE_REFRESH) {
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
        const newData = await getLatestData(this.env);

        // Keep the current data if the raised amount is not valid
        if (!newData || (this.summary && newData.raised === 0 && this.summary.raised !== 0)) {
            console.log(`Raised amount invalid... Keeping old data`);
            return;
        }

        // Check if the campaigns failed to load, if so, keep the old campaigns
        if (this.summary && newData.campaigns.count === 0 && this.summary.campaigns.count > 0) {
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
        if (now - this.lastSnapshot < SNAPSHOT_INTERVAL_MS) {
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

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function errorResponse(error: string, status: number): Response {
    return jsonResponse({ error }, status);
}

// Fields shared by the summary, list and single-object responses
function getEnvelope(summary: ApiResponse) {
    return {
        date: summary.date,
        event: summary.event,
        dollarConversionRate: summary.dollarConversionRate
    };
}

// The type used by the campaign list's type filter. A team campaign is a campaign owned by a team
// (a team event's supporting campaigns are owned by users, so they are plain campaigns).
function getCampaignType(campaign: Campaign): string {
    if (campaign.type === 'campaign') {
        return campaign.team ? 'team_campaign' : 'campaign';
    }
    return campaign.type;
}

// Builds a cause for the whole event, so it can be served in the same shape as a single cause
function getEventCause(summary: ApiResponse, env: Env, url: URL): Cause {
    const causeNames = summary.causes.map(cause => cause.name);
    const causeList = causeNames.length > 1
        ? `${causeNames.slice(0, -1).join(', ')} and ${causeNames[causeNames.length - 1]}`
        : causeNames.join('');

    // Every cause's donate link points at the same Tiltify fundraiser, so use its home page
    let donateUrl = EVENT_WEBSITE_URL;
    try {
        if (summary.causes[0]?.donateUrl) {
            donateUrl = new URL(summary.causes[0].donateUrl).origin;
        }
    } catch { }

    return {
        id: env.FUNDRAISER_PUBLIC_ID,
        slug: env.CAUSE_SLUG,
        name: EVENT_NAME,
        logo: url.origin + EVENT_LOGO_PATH,
        borderedLogo: url.origin + EVENT_LOGO_PATH,
        description: `Raising money for ${causeNames.length} causes: ${causeList}.`,
        color: EVENT_COLOR,
        url: EVENT_WEBSITE_URL,
        donateUrl: donateUrl,
        raised: roundAmount(summary.raised),
        campaigns: summary.campaigns.count,
        live: summary.campaigns.live || 0,
    };
}

// Summaries persisted before causes had a slug won't include one, so fall back to generating it from the name
function getCauseSlug(cause: Cause): string {
    return (cause.slug || generateSlug(cause.name) || cause.id).toLowerCase();
}

async function hash(value: unknown): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
