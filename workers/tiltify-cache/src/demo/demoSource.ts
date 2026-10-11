import { getDefaultResponse, normalizeEnv } from "tiltify-cache/api";
import { LATEST_DONATION_LIMIT, TOP_DONOR_LIMIT } from "tiltify-cache/constants";
import { DemoClock, DemoEvent, DemoMode } from "tiltify-cache/demo/clock";
import { chance, hashRandom, pick, seededRandom } from "tiltify-cache/demo/random";
import { createRoster, DemoFundraiser, DemoRoster, getRosterKey } from "tiltify-cache/demo/roster";
import { DONATION_AMOUNTS, DONATION_COMMENTS, DONOR_NAMES } from "tiltify-cache/demo/words";
import { getEmptyDetails } from "tiltify-cache/services/factDetails";
import { ApiResponse } from "tiltify-cache/types/ApiResponse";
import { Campaign } from "tiltify-cache/types/Campaign";
import { Cause } from "tiltify-cache/types/Cause";
import { CurrentGraphPoint } from "tiltify-cache/types/CurrentGraphPoint";
import { DataSource } from "tiltify-cache/types/DataSource";
import { Env } from "tiltify-cache/types/env";
import { FactDetails, LatestDonation, TopDonor } from "tiltify-cache/types/FactDetails";
import { roundAmount, sortByKey } from "tiltify-cache/utils";

const HOUR_MS = 60 * 60 * 1000;
const EVENT_START_HOUR = 17; // The real event starts at 17:00 UK time, which sets the time of day for how many are live
const AVERAGE_DONATION = 38.5; // Sets the event's donation count from its total
const COLLECTION_RATE = 0.42; // Share of donations that claim the Games Collection
const MATCHED_RATE = 0.5; // What a donation match adds for each pound donated, until its pledge runs out
const PEAK_STEEPNESS = 30; // How sharply a fundraiser's donations bunch up around its big stream

/*
  Demo Source

  Generated data for testing the pages without Tiltify, used when DEMO_MODE is set. The event's dates come from the demo
  clock, so the event is about to start, under way, or about to end when the demo is first requested.

  The fundraisers are generated once (tiltify-cache/demo/roster). Every amount is worked out from how far through the
  event it is, so the same moment always gives the same numbers: totals only go up, nothing is raised before the
  start, and everything stops at the end. Before the start there are no campaigns or team events. Some are published as
  it starts and the rest during it, so the list grows, and each raises its money between being published and the end. Fundraisers stream for half an hour to a few hours at a time,
  more of them in the evening than overnight, and most on the opening night.
*/
export class DemoSource implements DataSource {
    readonly demo = true;
    private env: Env;
    private clock: DemoClock;
    private roster: DemoRoster | null = null;
    private timeline: { start: number; key: string; points: CurrentGraphPoint[] } | null = null;

    constructor(env: Env, mode: DemoMode) {
        normalizeEnv(env);
        this.env = env;
        this.clock = new DemoClock(env.JINGLE_JAM_DATA, mode, env.YEAR);
    }

    async getLatestData(): Promise<ApiResponse> {
        const now = new Date();
        const [event, response] = await Promise.all([this.clock.getEvent(), getDefaultResponse(this.env, now)]);
        response.event.start = event.start;
        response.event.end = event.end;

        const roster = this.getRoster(response.causes);
        const progress = getProgress(now.getTime(), event);
        const own = new Map(roster.fundraisers.map(fundraiser => [fundraiser, getOwnAmount(fundraiser, progress)]));

        // Money given to every cause: donations to the event itself, and to campaigns that don't pick a cause
        let shared = roster.direct * eventCurve(progress);
        const campaigns: Campaign[] = [];
        for (const fundraiser of roster.fundraisers) {
            if (!isPublished(fundraiser, now.getTime(), event)) {
                continue;
            }

            const ownAmount = own.get(fundraiser) || 0;
            const supportingAmount = fundraiser.supporting.reduce((sum, member) => sum + (own.get(member) || 0), 0);
            const live = isLive(fundraiser, now.getTime(), event);
            campaigns.push(getCampaign(fundraiser, ownAmount, supportingAmount, live, event));

            // A team event only counts its own donations, as its supporting campaigns count towards their own cause
            const cause = response.causes.find(c => c.id === fundraiser.campaign.causeId);
            if (cause) {
                cause.raised += ownAmount;
                cause.raisedDirect += ownAmount;
                cause.campaigns++;
                if (live) {
                    cause.live++;
                }
            } else {
                shared += ownAmount;
            }
        }

        for (const cause of response.causes) {
            cause.raised = roundAmount(cause.raised + shared / response.causes.length);
            cause.raisedDirect = roundAmount(cause.raisedDirect);
        }

        response.raised = getTotal(roster, progress);
        response.donations = Math.round(response.raised / AVERAGE_DONATION);
        response.collections.redeemed = Math.min(response.collections.total, Math.round(response.donations * COLLECTION_RATE));
        response.campaigns = {
            count: campaigns.length,
            live: campaigns.filter(campaign => campaign.live).length,
            list: sortByKey(campaigns, 'raised'),
        };

        return response;
    }

    async getFactDetails(id: string): Promise<FactDetails> {
        const [event, roster] = await Promise.all([this.clock.getEvent(), this.roster || this.loadRoster()]);
        const fundraiser = roster.byId.get(id.toLowerCase());
        if (!fundraiser) {
            return getEmptyDetails();
        }

        const progress = getProgress(Date.now(), event);
        const own = getOwnAmount(fundraiser, progress);
        const raised = fundraiser.supporting.reduce((sum, member) => sum + getOwnAmount(member, progress), own);

        return {
            social: fundraiser.social,
            donationMatches: fundraiser.matches.map(match => ({
                id: match.id,
                matchedBy: match.matchedBy,
                pledged: match.pledged,
                matched: roundAmount(Math.min(match.pledged, own * MATCHED_RATE)),
                startsAt: getPublishedDate(fundraiser, event).toISOString(),
                endsAt: match.untilEnd ? event.end.toISOString() : null,
            })),
            rewards: fundraiser.rewards.map(reward => ({
                id: reward.id,
                name: reward.name,
                description: reward.description,
                image: reward.image,
                amount: reward.amount,
                quantity: reward.quantity,
                remaining: reward.quantity === null
                    ? null
                    : Math.max(0, reward.quantity - Math.floor(reward.quantity * Math.min(1, eventCurve(getFundraiserProgress(fundraiser, progress)) * reward.sellRate))),
                startsAt: null,
                endsAt: reward.untilEnd ? event.end.toISOString() : null,
            })),
            topDonors: fundraiser.donorLeaderboard ? getTopDonors(fundraiser, raised) : null,
            latestDonations: getLatestDonations(fundraiser, raised),
            teamMemberCount: fundraiser.campaign.type === 'team_event'
                ? fundraiser.supporting.filter(member => isPublished(member, Date.now(), event)).length + fundraiser.extraMembers
                : null,
        };
    }

    // The event's total every GRAPH_REFRESH_TIME seconds from the start, as the graph loop would have recorded it
    async getTimeline(): Promise<CurrentGraphPoint[]> {
        const [event, roster] = await Promise.all([this.clock.getEvent(), this.loadRoster()]);
        const step = (Number(this.env.GRAPH_REFRESH_TIME) || 600) * 1000;
        const start = event.start.getTime();

        if (!this.timeline || this.timeline.start !== start || this.timeline.key !== roster.key) {
            this.timeline = { start, key: roster.key, points: [this.getPoint(start, 0)] };
        }

        const points = this.timeline.points;
        const last = Math.min(Date.now(), event.end.getTime());
        for (let date = points[points.length - 1].date + step; date <= last; date += step) {
            points.push(this.getPoint(date, getTotal(roster, getProgress(date, event))));
        }

        return points;
    }

    private getPoint(date: number, pounds: number): CurrentGraphPoint {
        return { date, p: pounds, d: roundAmount(pounds * this.env.CONVERSION_RATE) };
    }

    // The fundraisers for these causes, generated again only when the causes change
    private getRoster(causes: Cause[]): DemoRoster {
        if (!this.roster || this.roster.key !== getRosterKey(causes)) {
            this.roster = createRoster(causes);
        }
        return this.roster;
    }

    private async loadRoster(): Promise<DemoRoster> {
        let causes: Cause[] = [];
        try {
            causes = JSON.parse(await this.env.JINGLE_JAM_DATA.get('causes') || '[]') || [];
        } catch { }
        return this.getRoster(causes);
    }
}

// How far through the event a time is, from 0 (before the start) to 1 (after the end)
function getProgress(time: number, event: DemoEvent): number {
    const start = event.start.getTime();
    const end = event.end.getTime();
    return Math.min(1, Math.max(0, (time - start) / (end - start)));
}

// Share of the event's total raised by a point in the event: a big opening night, a steady middle and a final push
const EVENT_CURVE_END = 0.25 * (1 - Math.exp(-40)) + 0.65 + 0.1;
function eventCurve(progress: number): number {
    return (0.25 * (1 - Math.exp(-40 * progress)) + 0.65 * progress + 0.1 * Math.pow(progress, 8)) / EVENT_CURVE_END;
}

// Nothing is published before the event starts, so until then there are no campaigns or team events at all
function isPublished(fundraiser: DemoFundraiser, time: number, event: DemoEvent): boolean {
    return time >= getPublishedDate(fundraiser, event).getTime();
}

function getPublishedDate(fundraiser: DemoFundraiser, event: DemoEvent): Date {
    return new Date(event.start.getTime() + fundraiser.publishedAt * (event.end.getTime() - event.start.getTime()));
}

// How far a fundraiser is through its own time raising money, from 0 (when it was published) to 1 (the end of the event)
function getFundraiserProgress(fundraiser: DemoFundraiser, progress: number): number {
    return progress <= fundraiser.publishedAt ? 0 : (progress - fundraiser.publishedAt) / (1 - fundraiser.publishedAt);
}

// Share of a fundraiser's total raised by a point in its own time: half follows the event's shape, half comes around its big stream
function fundraiserCurve(progress: number, peak: number): number {
    const at = (x: number) => 1 / (1 + Math.exp(-PEAK_STEEPNESS * (x - peak)));
    return 0.5 * eventCurve(progress) + 0.5 * (at(progress) - at(0)) / (at(1) - at(0));
}

// What a fundraiser has raised itself (not counting a team event's supporting campaigns), to the penny.
// Rounded with arithmetic rather than roundAmount, which is too slow for the thousands of timeline points.
function getOwnAmount(fundraiser: DemoFundraiser, progress: number): number {
    return Math.round(fundraiser.share * fundraiserCurve(getFundraiserProgress(fundraiser, progress), fundraiser.peak) * 100) / 100;
}

function getTotal(roster: DemoRoster, progress: number): number {
    return roundAmount(roster.fundraisers.reduce((sum, fundraiser) => sum + getOwnAmount(fundraiser, progress), roster.direct * eventCurve(progress)));
}

// Each of a fundraiser's streams has a fixed chance of being live, and how busy the event is sets how much of that
// chance it needs to go live, so the live count rises and falls through the day
function isLive(fundraiser: DemoFundraiser, time: number, event: DemoEvent): boolean {
    const start = event.start.getTime();
    const end = event.end.getTime();
    if (time < start || time > end || !isPublished(fundraiser, time, event) || fundraiser.liveChance <= 0) {
        return false;
    }
    if (fundraiser.liveChance >= 1) {
        return true;
    }

    const elapsed = time - start;
    const stream = Math.floor((elapsed + fundraiser.streamOffset) / fundraiser.streamLength);
    return hashRandom(fundraiser.seed, stream) < fundraiser.liveChance * getActivity(elapsed, end - start);
}

// How busy the event is: from 0.2 in the morning to 1 in the evening (in the event's time of day, starting at 17:00),
// doubled at the start of the opening night and up by half at the very end
function getActivity(elapsed: number, length: number): number {
    const hour = (EVENT_START_HOUR + elapsed / HOUR_MS) % 24;
    const timeOfDay = 0.6 + 0.4 * Math.cos(2 * Math.PI * (hour - 20) / 24);
    const openingNight = 1 + Math.exp(-elapsed / (8 * HOUR_MS));
    const finalDay = 1 + 0.5 * Math.exp(-(length - elapsed) / (12 * HOUR_MS));
    return timeOfDay * openingNight * finalDay;
}

function getCampaign(fundraiser: DemoFundraiser, own: number, supporting: number, live: boolean, event: DemoEvent): Campaign {
    return {
        ...fundraiser.campaign,
        startTime: getPublishedDate(fundraiser, event).toISOString(),
        raised: roundAmount(own + supporting),
        ...(fundraiser.campaign.type === 'team_event' ? { raisedBreakdown: { teamEvent: own, campaigns: roundAmount(supporting) } } : {}),
        live,
    };
}

// Largest first, the top donor giving topDonorShare of the amount raised
function getTopDonors(fundraiser: DemoFundraiser, raised: number): TopDonor[] {
    const random = seededRandom(fundraiser.seed);
    return Array.from({ length: Math.min(TOP_DONOR_LIMIT, Math.floor(raised / 20)) }, (_, i) => ({
        name: pick(random, DONOR_NAMES),
        amount: Math.max(5, Math.round(raised * fundraiser.topDonorShare / Math.pow(i + 1, 0.9))),
    }));
}

// Newest first. Each donation is generated from its number, so new ones appear at the top as the amount raised grows.
function getLatestDonations(fundraiser: DemoFundraiser, raised: number): LatestDonation[] {
    const donations: LatestDonation[] = [];
    for (let i = Math.floor(raised / fundraiser.averageDonation) - 1; i >= 0 && donations.length < LATEST_DONATION_LIMIT; i--) {
        const random = seededRandom(fundraiser.seed ^ Math.imul(i + 1, 0x85EBCA6B));
        donations.push({
            name: pick(random, DONOR_NAMES),
            amount: pick(random, DONATION_AMOUNTS),
            comment: chance(random, 0.45) ? pick(random, DONATION_COMMENTS) : null,
        });
    }
    return donations;
}
