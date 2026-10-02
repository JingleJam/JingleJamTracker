import { beforeAll, describe, expect, it, vi } from "vitest";
import { getLatestData } from "tiltify-cache/api";
import { getFact, getLeaderboards } from "tiltify-cache/dependencies/tiltify";
import { ApiResponse } from "tiltify-cache/types/ApiResponse";
import { Env } from "tiltify-cache/types/env";
import { TiltifyMultiSearchCampaign } from "tiltify-cache/types/tiltify/TiltifyMultiSearchCampaign";
import causes2025 from "./fixtures/causes-2025.json";

/*
    Tests against the real Tiltify API, using the finished Jingle Jam 2025 event.

    Run with `npm run test:live`. These need network access and aren't run in CI.

    The 2025 event is retired, so its data should no longer change. Some checks call Tiltify's search directly,
    separately from the tracker's code, so the tracker's results are compared against an independent answer.
*/

const EVENT_2025 = "8bd643d3-07ae-4aab-bc2e-5179064bfebf";
const ALL_CHARITIES_REGION_2025 = "0f5718f6-bf64-4001-b0ba-30195f81de02";
const SEARCH_LIMIT = 1000;

// Final 2025 figures from Tiltify, after the event was retired
const EVENT_TOTAL_2025 = 3501359.21;
const FUNDRAISERS_2025 = { campaign: 934, team_event: 29, auction_house: 4 };

function createEnv(): Env {
    const kv: Record<string, string> = {
        causes: JSON.stringify(causes2025),
        summary: "[]",
    };

    return {
        YEAR: 2025,
        COLLECTIONS_AVAILABLE: 100000,
        DOLLAR_OFFSET: 8215739.75,
        DONATION_DIFFERENCE: 0,
        CONVERSION_RATE: 1.33,
        CAUSE_SLUG: "jingle-jam",
        FUNDRAISER_PUBLIC_ID: EVENT_2025,
        ALL_CHARITIES_REGION_ID: ALL_CHARITIES_REGION_2025,
        YOGSCAST_USERNAME: "yogscast",
        LIVE_REFRESH_TIME: 10,
        ENABLE_REFRESH: false,
        GRAPH_REFRESH_TIME: 600,
        ENABLE_GRAPH_REFRESH: false,
        ENABLE_DEBUG: false,
        ADMIN_TOKEN: undefined,
        JINGLE_JAM_DATA: { get: async (key: string) => kv[key] ?? null } as unknown as KVNamespace,
        TILTIFY_DATA: {} as DurableObjectNamespace,
    };
}

// Query Tiltify's search directly, without going through the tracker's code
async function searchTiltify(filter: string, page = 1): Promise<{ hits: TiltifyMultiSearchCampaign[], totalHits: number, totalPages: number }> {
    const response = await fetch("https://api.tiltify.com/search/multi-search", {
        method: "POST",
        headers: { "content-type": "application/json", "Origin": "https://jinglejam.tiltify.com" },
        body: JSON.stringify({ queries: [{ indexUid: "facts", filter: [filter], hitsPerPage: 100, page }] }),
    });
    const data = await response.json() as any;
    return data.results[0];
}

async function searchAllPages(filter: string): Promise<TiltifyMultiSearchCampaign[]> {
    const first = await searchTiltify(filter);
    const rest = await Promise.all(Array.from({ length: Math.max(first.totalPages - 1, 0) }, (_, i) => searchTiltify(filter, i + 2)));
    return [first, ...rest].flatMap(result => result.hits);
}

const eventFilter = `fundraising_event_public_id = ${EVENT_2025} AND status IN [published, retired]`;

describe("getLatestData against Tiltify (Jingle Jam 2025)", () => {
    let data: ApiResponse;
    let warnings: unknown[][];

    beforeAll(async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const error = vi.spyOn(console, "error");

        data = await getLatestData(createEnv());

        warnings = warn.mock.calls;
        expect(error).not.toHaveBeenCalled();
        vi.restoreAllMocks();
    });

    it("reads the 2025 event total", () => {
        expect(data.raised).toBe(EVENT_TOTAL_2025);
    });

    describe("campaign search", () => {
        it("returns every 2025 fundraiser that a single unsplit search finds", async () => {
            const unsplit = await searchTiltify(eventFilter);

            expect(data.campaigns.count).toBe(unsplit.totalHits);
        });

        it("returns each fundraiser once", () => {
            const ids = data.campaigns.list.map(campaign => campaign.id);

            expect(new Set(ids).size).toBe(ids.length);
        });

        it("returns the expected mix of campaigns, team events and auction houses", () => {
            const byType: Record<string, number> = {};
            for (const campaign of data.campaigns.list) {
                byType[campaign.type] = (byType[campaign.type] || 0) + 1;
            }

            expect(byType).toEqual(FUNDRAISERS_2025);
        });

        it("includes team events, which are no longer public once retired", () => {
            const teamEvent = data.campaigns.list.find(campaign => campaign.name === "CoreKeeper Survive-A-Thon");

            expect(teamEvent?.type).toBe("team_event");
            expect(teamEvent?.causeId).toBe("5350a34a-8b94-4513-bb1d-22becc2df6e4"); // Make-A-Wish
        });

        it("keeps every search group under the 1000 result limit", () => {
            expect(warnings).toEqual([]);
        });
    });

    describe("cause totals", () => {
        it("counts the same number of fundraisers per cause as searching Tiltify by region", async () => {
            for (const cause of data.causes) {
                const result = await searchTiltify(`${eventFilter} AND region_public_id = ${cause.id}`);

                expect(cause.campaigns, cause.name).toBe(result.totalHits);
            }
        });

        it("adds up to the event total", () => {
            const causeSum = data.causes.reduce((sum, cause) => sum + cause.raised, 0);

            // Each campaign's share is rounded to the penny, so allow for a few pounds of rounding across ~1000 campaigns
            expect(Math.abs(causeSum - data.raised)).toBeLessThan(10);
        });

        it("doesn't count supporting campaigns twice", async () => {
            const fundraisers = await searchAllPages(eventFilter);
            const teamEvents = fundraisers.filter(fundraiser => fundraiser.type === "team_event");
            const supporting = fundraisers.filter(fundraiser => fundraiser.team_event_public_id);

            // A team event's total is its direct donations plus its supporting campaigns
            const teamTotals = teamEvents.reduce((sum, teamEvent) => sum + teamEvent.total_amount_raised, 0);
            const teamDirect = teamEvents.reduce((sum, teamEvent) => sum + teamEvent.amount_raised, 0);
            const supportingTotal = supporting.reduce((sum, campaign) => sum + campaign.total_amount_raised, 0);
            expect(Math.abs((teamTotals - teamDirect) - supportingTotal)).toBeLessThan(50);

            // Counting team events' direct donations plus every campaign stays within the event total
            const counted = fundraisers.reduce((sum, fundraiser) =>
                sum + (fundraiser.type === "team_event" ? fundraiser.amount_raised : fundraiser.total_amount_raised), 0);
            expect(counted).toBeLessThan(data.raised);
        });

        it("matches the 2025 cause totals", () => {
            // The tracker's output for 2025 at the time these tests were written, including the manual overrides in
            // causes-2025.json. A change here means the calculation changed, so check it was intended.
            const raised = Object.fromEntries(data.causes.map(cause => [cause.name, cause.raised]));

            expect(raised).toEqual({
                "Autistica": 326079.18,
                "Become": 369088.81,
                "CALM": 503737.61,
                "The Grand Appeal": 467347.97,
                "Make-A-Wish": 467910.86,
                "The Trevor Project": 498315.97,
                "War Child": 476372.65,
                "WWF": 392511.3,
            });
        });
    });
});

describe("single fundraiser queries against Tiltify (Jingle Jam 2025)", () => {
    // Tiltify only accepts the queries its own website sends, so these fail if Tiltify changes or stops allowing a query
    const YOGSCAST_CAMPAIGN_2025 = "7f6e131d-e6cf-4659-9d48-7b4af11e498c";
    const TEAM_EVENT_2025 = "05b4e0a7-ef8c-43b4-9f12-cf7f2ea89907"; // CoreKeeper Survive-A-Thon

    it("reads a campaign's live data", async () => {
        const fact = await getFact(YOGSCAST_CAMPAIGN_2025);

        expect(fact?.name).toBe("Jingle Jam 2025");
        expect(fact?.social).toBeDefined();
        expect(fact?.donationMatches).toBeInstanceOf(Array);

        // The Games Collection is the fundraising event's reward, which the tracker leaves out
        expect(fact?.rewards.map(reward => reward.ownerUsageType)).toContain("fundraising_event_activation");
    });

    it("reads a team event's member count", async () => {
        const fact = await getFact(TEAM_EVENT_2025);

        expect(fact?.usageType).toBe("team_event");
        expect(fact?.teamMemberCount).toBeGreaterThan(0);
    });

    it("reads the top donors, highest first", async () => {
        const leaderboards = await getLeaderboards(YOGSCAST_CAMPAIGN_2025, 25);
        const amounts = (leaderboards?.donorLeaderboard?.entries.edges || []).map(edge => parseFloat(edge.node.amount.value));

        expect(amounts).toHaveLength(25);
        expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
    });
});
