import { ALL_CAUSES_COLOR, ALL_CAUSES_NAME } from "tiltify-cache/constants";
import { ApiResponse } from "tiltify-cache/types/ApiResponse";
import { Campaign } from "tiltify-cache/types/Campaign";
import { Cause } from "tiltify-cache/types/Cause";
import { DonationHistory } from "tiltify-cache/types/DonationHistory";
import { generateSlug, roundAmount } from "tiltify-cache/utils";

/*
  Response shapes

  The Durable Object keeps the summary in its internal format (ApiResponse). These functions turn it into:
    - the v1 API responses (/api/v1/*)
    - the 2025 responses still served at /api/tiltify and /api/campaigns until the 2027 event
*/

const EVENT_CAMPAIGN_LIMIT = 25; // Number of top campaigns included in the event response

// When the data was refreshed, the event dates and the GBP → USD rate, included in every v1 response except the timelines
export interface Meta {
    updatedAt: Date;
    event: {
        year: number;
        startsAt: Date;
        endsAt: Date;
    };
    dollarConversionRate: number;
}

// How much of an amount raised was given to a cause specifically, and how much was its share of money given to every cause
export interface RaisedBreakdown {
    direct: number;
    shared: number;
}

export interface PublicCause extends Omit<Cause, 'override' | 'raisedDirect'> {
    raisedBreakdown: RaisedBreakdown;
}

// The cause a campaign supports. A campaign supporting every cause has a null id and slug.
export interface CampaignCause {
    id: string | null;
    slug: string | null;
    name: string;
    color: string;
}

export interface PublicCampaign extends Omit<Campaign, 'causeId' | 'startTime'> {
    cause: CampaignCause;
}

// One page of campaigns, out of the `total` that matched
export interface CampaignCollection {
    total: number;
    live: number;
    limit: number;
    offset: number;
    items: PublicCampaign[];
}

export interface YearResult extends Omit<DonationHistory, 'event'> {
    event: {
        startsAt: string;
        endsAt: string;
    };
}

export interface EventResponse {
    meta: Meta;
    raised: number;
    raisedBreakdown: RaisedBreakdown;
    donations: number;
    collections: ApiResponse['collections'];
    history: YearResult[];
    causes: PublicCause[];
    campaigns: CampaignCollection;
}

export function getMeta(summary: ApiResponse): Meta {
    return {
        updatedAt: summary.date,
        event: {
            year: summary.event.year,
            startsAt: summary.event.start,
            endsAt: summary.event.end,
        },
        dollarConversionRate: summary.dollarConversionRate,
    };
}

// A page of campaigns from a list that's already filtered and sorted
export function getCampaignCollection(campaigns: Campaign[], causes: Cause[], limit: number, offset = 0): CampaignCollection {
    return {
        total: campaigns.length,
        live: campaigns.filter(campaign => campaign.live).length,
        limit,
        offset,
        items: campaigns.slice(offset, offset + limit).map(campaign => getCampaign(campaign, causes)),
    };
}

export function getEventResponse(summary: ApiResponse): EventResponse {
    return {
        meta: getMeta(summary),
        raised: summary.raised,
        raisedBreakdown: getRaisedBreakdown(summary.raised, summary.causes.reduce((sum, cause) => sum + (cause.raisedDirect || 0), 0)),
        donations: summary.donations,
        collections: summary.collections,
        history: summary.history.map(year => {
            const { event, ...rest } = year;
            return { ...rest, event: { startsAt: event.start, endsAt: event.end } };
        }),
        causes: summary.causes.map(getCause),
        campaigns: {
            // The summary only holds the top campaigns, but its counts cover every campaign
            total: summary.campaigns.count,
            live: summary.campaigns.live || 0,
            limit: EVENT_CAMPAIGN_LIMIT,
            offset: 0,
            items: summary.campaigns.list.slice(0, EVENT_CAMPAIGN_LIMIT).map(campaign => getCampaign(campaign, summary.causes)),
        },
    };
}

// Turn an event response back into the internal format, for the admin update. Its top campaigns replace the cached ones,
// keeping the publish time of any campaign that's already in the cached list.
export function getSummaryFromEventResponse(event: EventResponse, cachedCampaigns: Campaign[]): ApiResponse {
    const startTimes = new Map(cachedCampaigns.map(campaign => [campaign.id, campaign.startTime]));

    return {
        date: new Date(event.meta.updatedAt),
        event: {
            year: event.meta.event.year,
            start: new Date(event.meta.event.startsAt),
            end: new Date(event.meta.event.endsAt),
        },
        dollarConversionRate: event.meta.dollarConversionRate,
        raised: event.raised,
        collections: event.collections,
        donations: event.donations,
        history: event.history.map(year => {
            const { event, ...rest } = year;
            return { ...rest, event: { start: event.startsAt, end: event.endsAt } };
        }),
        causes: event.causes.map(cause => {
            const { raisedBreakdown, ...rest } = cause;
            return { ...rest, raisedDirect: raisedBreakdown.direct };
        }),
        campaigns: {
            count: event.campaigns.total,
            live: event.campaigns.live,
            list: event.campaigns.items.map(campaign => {
                const { cause, ...rest } = campaign;
                return { ...rest, causeId: cause.id, startTime: startTimes.get(campaign.id) ?? null };
            }),
        },
    };
}

// A cause without any internal fields, with its raised amount broken down
export function getCause(cause: Cause): PublicCause {
    const { override, raisedDirect, ...rest } = cause;
    return {
        ...rest,
        slug: getCauseSlug(cause),
        raisedBreakdown: getRaisedBreakdown(cause.raised, raisedDirect || 0),
    };
}

// The shared part is worked out from the rounded amounts, so the two parts always add up to the total.
// Summaries persisted before the direct amount was recorded count everything as shared until the next refresh.
function getRaisedBreakdown(raised: number, direct: number): RaisedBreakdown {
    const roundedDirect = roundAmount(direct);
    return {
        direct: roundedDirect,
        shared: roundAmount(roundAmount(raised) - roundedDirect),
    };
}

// A campaign as the v1 API shows it, with the cause it supports
export function getCampaign(campaign: Campaign, causes: Cause[]): PublicCampaign {
    const cause = causes.find(c => c.id === campaign.causeId);

    return {
        id: campaign.id,
        slug: campaign.slug,
        name: campaign.name,
        description: campaign.description,
        url: campaign.url,
        cause: cause
            ? { id: cause.id, slug: getCauseSlug(cause), name: cause.name, color: cause.color }
            : { id: null, slug: null, name: ALL_CAUSES_NAME, color: ALL_CAUSES_COLOR },
        raised: campaign.raised,
        ...(campaign.type === 'team_event' ? getTeamEventBreakdown(campaign) : {}),
        goal: campaign.goal,
        live: campaign.live,
        donationMatchMultiplier: campaign.donationMatchMultiplier,
        type: campaign.type,
        team: campaign.team,
        teamEvent: campaign.teamEvent,
        user: campaign.user,
    };
}

// Campaign lists persisted before the team event breakdown was recorded count everything as donated to the campaigns until the next refresh
function getTeamEventBreakdown(teamEvent: Campaign): Pick<Campaign, 'raisedBreakdown'> {
    return {
        raisedBreakdown: teamEvent.raisedBreakdown || { teamEvent: 0, campaigns: teamEvent.raised },
    };
}

// Summaries persisted before causes had a slug won't include one, so fall back to generating it from the name
export function getCauseSlug(cause: Cause): string {
    return (cause.slug || generateSlug(cause.name) || cause.id).toLowerCase();
}

// The 2025 /api/tiltify response
export function getLegacySummary(summary: ApiResponse) {
    return {
        date: summary.date,
        event: summary.event,
        dollarConversionRate: summary.dollarConversionRate,
        raised: summary.raised,
        collections: summary.collections,
        donations: summary.donations,
        history: summary.history,
        causes: summary.causes.map(cause => ({
            id: cause.id,
            name: cause.name,
            logo: cause.borderedLogo || cause.logo,     // The 2025 logo was the square, bordered one
            description: cause.description,
            color: cause.color,
            url: cause.url,
            donateUrl: cause.donateUrl,
            raised: cause.raised,
            campaigns: cause.campaigns,
        })),
        campaigns: {
            count: summary.campaigns.count,
            list: summary.campaigns.list.map(getLegacyCampaign),
        },
    };
}

// A campaign in the 2025 /api/tiltify and /api/campaigns responses
export function getLegacyCampaign(campaign: Campaign) {
    return {
        causeId: campaign.causeId,
        name: campaign.name,
        description: campaign.description,
        id: campaign.id,
        slug: campaign.slug,
        url: campaign.url,
        startTime: campaign.startTime,
        raised: campaign.raised,
        goal: campaign.goal,
        type: campaign.type,
        team: campaign.team,
        user: campaign.user,
    };
}
