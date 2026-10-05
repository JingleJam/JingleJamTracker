import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLatestData } from "tiltify-cache/api";
import { Env } from "tiltify-cache/types/env";
import { TiltifyMultiSearchCampaign } from "tiltify-cache/types/tiltify/TiltifyMultiSearchCampaign";

/*
    Tests for getLatestData against a fake Tiltify.

    The fake search behaves like Tiltify's real search (Meilisearch): it applies the same filter syntax the
    tracker sends, pages results, and returns at most 1000 results per query (maxTotalHits).
*/

const EVENT_ID = "event-2026";
const ALL_CHARITIES_REGION_ID = "region-all";
const CAUSE_IDS = ["cause-1", "cause-2", "cause-3", "cause-4", "cause-5", "cause-6", "cause-7", "cause-8"];
const SEARCH_LIMIT = 1000;

let fundraisers: TiltifyMultiSearchCampaign[] = [];
let eventTotal = 0;
let searchFilters: string[] = [];
let nextId = 0;

// Build a search hit, with defaults for a published campaign in this year's event
function fundraiser(overrides: Partial<TiltifyMultiSearchCampaign> = {}): TiltifyMultiSearchCampaign {
    const id = `fundraiser-${nextId++}`;
    return {
        id,
        name: id,
        username: `user-${id}`,
        url: `https://tiltify.com/@user-${id}/${id}`,
        type: "campaign",
        status: "published",
        public: true,
        live: false,
        fundraising_event_public_id: EVENT_ID,
        region_public_id: null,
        team_event_public_id: null,
        team_public_id: null,
        amount_raised: 0,
        total_amount_raised: 0,
        goal: 0,
        match_count: 0,
        ...overrides,
    } as TiltifyMultiSearchCampaign;
}

// Evaluate one filter clause the way Meilisearch does. Throws on syntax the fake doesn't know, so tests fail loudly.
function matchesClause(hit: TiltifyMultiSearchCampaign, clause: string): boolean {
    const record = hit as unknown as Record<string, unknown>;

    let match = clause.match(/^(NOT )?(\w+) IN \[(.*)\]$/);
    if (match) {
        const values = match[3].split(",").map(value => value.trim());
        const isIn = values.includes(String(record[match[2]]));
        return match[1] ? !isIn : isIn;
    }

    match = clause.match(/^(\w+) = (.+)$/);
    if (match) {
        return String(record[match[1]]) === match[2];
    }

    throw new Error(`Fake search doesn't support filter clause: ${clause}`);
}

function search(body: any) {
    const query = body.queries[0];
    const filter: string = query.filter[0];
    searchFilters.push(filter);

    const matches = fundraisers
        .filter(hit => filter.split(" AND ").every(clause => matchesClause(hit, clause)))
        .slice(0, SEARCH_LIMIT);

    const totalPages = Math.ceil(matches.length / query.hitsPerPage);
    const hits = query.page >= 1 ? matches.slice((query.page - 1) * query.hitsPerPage, query.page * query.hitsPerPage) : [];

    return {
        results: [{
            indexUid: query.indexUid,
            hits,
            query: "",
            processingTimeMs: 0,
            hitsPerPage: query.hitsPerPage,
            page: query.page,
            totalPages,
            totalHits: matches.length,
            requestUid: "",
        }],
    };
}

async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = input.toString();
    const body = init?.body ? JSON.parse(init.body as string) : null;

    if (url === "https://api.tiltify.com/search/multi-search") {
        return Response.json(search(body));
    }

    if (url === "https://api.tiltify.com/" && body.operationName === "get_default_template_fact") {
        return Response.json({
            data: {
                fact: {
                    totalAmountRaised: { currency: "GBP", value: eventTotal.toFixed(2) },
                    rewards: [{ quantity: 100, remaining: 100 }],
                },
            },
        });
    }

    if (url === "https://api.tiltify.com/" && body.operationName === "get_user_by_slug") {
        return Response.json({ data: { user: null } });
    }

    if (url === "https://jinglejam.yogscast.com/api/total") {
        return Response.json({ donations: 0 });
    }

    throw new Error(`Unexpected fetch: ${url}`);
}

// overrides: manual adjustments to add to causes, by cause id
function createEnv(overrides: Record<string, number> = {}): Env {
    const kv: Record<string, string> = {
        causes: JSON.stringify(CAUSE_IDS.map(id => ({ id, name: id, override: overrides[id] }))),
        summary: "[]",
    };

    return {
        YEAR: 2026,
        COLLECTIONS_AVAILABLE: 100,
        DOLLAR_OFFSET: 0,
        DONATION_DIFFERENCE: 0,
        CONVERSION_RATE: 1.33,
        FUNDRAISER_PUBLIC_ID: EVENT_ID,
        ALL_CHARITIES_REGION_ID,
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

function raisedByCause(data: Awaited<ReturnType<typeof getLatestData>>): Record<string, number> {
    return Object.fromEntries(data.causes.map(cause => [cause.id, cause.raised]));
}

// The amount the tracker should count for these fundraisers (a team event only counts its direct donations)
function totalOf(hits: TiltifyMultiSearchCampaign[]): number {
    return hits.reduce((sum, hit) => sum + (hit.type === "team_event" ? hit.amount_raised : hit.total_amount_raised), 0);
}

describe("getLatestData", () => {
    let consoleError: ReturnType<typeof vi.spyOn>;
    let consoleWarn: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        fundraisers = [];
        eventTotal = 0;
        searchFilters = [];
        nextId = 0;
        vi.stubGlobal("fetch", vi.fn(fakeFetch));
        consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        // getSummaryData catches and logs errors, so an unexpected error would otherwise go unnoticed
        expect(consoleError).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe("campaign search", () => {
        it("splits the search into both halves of the causes plus a catch-all", async () => {
            await getLatestData(createEnv());

            const groupFilters = [...new Set(searchFilters)];
            const base = `fundraising_event_public_id = ${EVENT_ID} AND status IN [published, retired]`;
            expect(groupFilters.sort()).toEqual([
                `${base} AND NOT region_public_id IN [${CAUSE_IDS.join(", ")}]`,
                `${base} AND region_public_id IN [${CAUSE_IDS.slice(0, 4).join(", ")}]`,
                `${base} AND region_public_id IN [${CAUSE_IDS.slice(4).join(", ")}]`,
            ].sort());
        });

        it("returns every fundraiser once when there are more than 1000 in total", async () => {
            for (let i = 0; i < 700; i++) fundraisers.push(fundraiser({ region_public_id: CAUSE_IDS[i % 4], total_amount_raised: 1 }));
            for (let i = 0; i < 500; i++) fundraisers.push(fundraiser({ region_public_id: CAUSE_IDS[4 + (i % 4)], total_amount_raised: 1 }));
            for (let i = 0; i < 300; i++) fundraisers.push(fundraiser({ region_public_id: null, total_amount_raised: 1 }));
            eventTotal = 1500;

            const data = await getLatestData(createEnv());

            const ids = data.campaigns.list.map(campaign => campaign.id);
            expect(ids).toHaveLength(1500);
            expect(new Set(ids).size).toBe(1500);
            expect(consoleWarn).not.toHaveBeenCalled();
        });

        it("warns when one group reaches the 1000 result limit", async () => {
            for (let i = 0; i < 1200; i++) fundraisers.push(fundraiser({ region_public_id: "cause-1", total_amount_raised: 1 }));
            eventTotal = 1200;

            const data = await getLatestData(createEnv());

            expect(data.campaigns.count).toBe(SEARCH_LIMIT);
            expect(consoleWarn).toHaveBeenCalledTimes(1);
            expect(consoleWarn.mock.calls[0][0]).toContain("cause-1");
        });

        it("includes retired fundraisers, including team events that are no longer public", async () => {
            const published = fundraiser({ status: "published" });
            const retiredCampaign = fundraiser({ status: "retired", public: true });
            const retiredTeamEvent = fundraiser({ type: "team_event", status: "retired", public: false });
            fundraisers.push(published, retiredCampaign, retiredTeamEvent);

            const data = await getLatestData(createEnv());

            expect(data.campaigns.list.map(campaign => campaign.id).sort())
                .toEqual([published.id, retiredCampaign.id, retiredTeamEvent.id].sort());
        });

        it("leaves out deleted and unpublished fundraisers", async () => {
            const kept = fundraiser({ total_amount_raised: 50 });
            fundraisers.push(
                kept,
                fundraiser({ status: "deleted", public: false, total_amount_raised: 50 }),
                fundraiser({ status: "unpublished", public: false, total_amount_raised: 50 }),
            );
            eventTotal = 50;

            const data = await getLatestData(createEnv());

            expect(data.campaigns.list.map(campaign => campaign.id)).toEqual([kept.id]);
        });

        it("leaves out fundraisers from other events", async () => {
            const kept = fundraiser();
            fundraisers.push(kept, fundraiser({ fundraising_event_public_id: "event-2025" }));

            const data = await getLatestData(createEnv());

            expect(data.campaigns.list.map(campaign => campaign.id)).toEqual([kept.id]);
        });

        it("types every fundraiser as a campaign or a team event, counting auction houses as campaigns", async () => {
            const teamEvent = fundraiser({ type: "team_event", total_amount_raised: 30 });
            const auctionHouse = fundraiser({ type: "auction_house", total_amount_raised: 20 });
            const plain = fundraiser({ total_amount_raised: 10 });
            fundraisers.push(teamEvent, auctionHouse, plain);

            const data = await getLatestData(createEnv());

            expect(data.campaigns.list.map(campaign => [campaign.id, campaign.type])).toEqual([
                [teamEvent.id, "team_event"],
                [auctionHouse.id, "campaign"],
                [plain.id, "campaign"],
            ]);
        });
    });

    describe("cause totals", () => {
        it("counts a campaign towards the cause it picked", async () => {
            fundraisers.push(fundraiser({ region_public_id: "cause-3", total_amount_raised: 250 }));
            eventTotal = 250;

            const raised = raisedByCause(await getLatestData(createEnv()));

            expect(raised["cause-3"]).toBe(250);
            expect(raised["cause-1"]).toBe(0);
        });

        it("counts a team event's direct donations towards its cause and supporting campaigns towards theirs", async () => {
            const teamEvent = fundraiser({ type: "team_event", region_public_id: "cause-1", amount_raised: 100, total_amount_raised: 400 });
            fundraisers.push(
                teamEvent,
                fundraiser({ region_public_id: "cause-2", team_event_public_id: teamEvent.id, total_amount_raised: 300 }),
            );
            eventTotal = 400;

            const raised = raisedByCause(await getLatestData(createEnv()));

            expect(raised["cause-1"]).toBe(100);
            expect(raised["cause-2"]).toBe(300);
            expect(raised["cause-3"]).toBe(0);
        });

        it("includes the team event's details on its supporting campaigns", async () => {
            const teamEvent = fundraiser({
                type: "team_event",
                name: "The Big Relay",
                url: "https://tiltify.com/+the-team/the-big-relay",
                fact_avatar: { src: "https://example.com/relay.png" } as TiltifyMultiSearchCampaign["fact_avatar"],
            });
            const supporting = fundraiser({ team_event_public_id: teamEvent.id });
            const other = fundraiser({ team_event_public_id: "team-event-not-in-this-event" });
            fundraisers.push(teamEvent, supporting, other);

            const list = (await getLatestData(createEnv())).campaigns.list;

            expect(list.find(campaign => campaign.id === supporting.id)?.teamEvent).toEqual({
                id: teamEvent.id,
                name: "The Big Relay",
                slug: "the-big-relay",
                avatar: "https://example.com/relay.png",
                url: "https://tiltify.com/+the-team/the-big-relay",
            });
            expect(list.find(campaign => campaign.id === other.id)?.teamEvent).toBeNull();
            expect(list.find(campaign => campaign.id === teamEvent.id)?.teamEvent).toBeNull();
        });

        it.each([
            ["the All The Charities region", ALL_CHARITIES_REGION_ID],
            ["no region", null],
            ["a region that isn't one of this year's causes", "region-from-last-year"],
        ])("splits a campaign with %s evenly across every cause", async (_, regionId) => {
            fundraisers.push(fundraiser({ region_public_id: regionId, total_amount_raised: 80 }));
            eventTotal = 80;

            const raised = raisedByCause(await getLatestData(createEnv()));

            for (const id of CAUSE_IDS) {
                expect(raised[id]).toBe(10);
            }
        });

        it("splits donations made directly to the event evenly across every cause", async () => {
            fundraisers.push(fundraiser({ region_public_id: "cause-1", total_amount_raised: 200 }));
            eventTotal = 1000;

            const raised = raisedByCause(await getLatestData(createEnv()));

            expect(raised["cause-1"]).toBe(300);
            expect(raised["cause-2"]).toBe(100);
        });

        it("adds up to the event total without counting any money twice", async () => {
            const teamEvent = fundraiser({ type: "team_event", region_public_id: ALL_CHARITIES_REGION_ID, amount_raised: 1200, total_amount_raised: 2000 });
            fundraisers.push(
                teamEvent,
                fundraiser({ region_public_id: "cause-4", team_event_public_id: teamEvent.id, total_amount_raised: 500 }),
                fundraiser({ region_public_id: null, team_event_public_id: teamEvent.id, total_amount_raised: 300 }),
                fundraiser({ region_public_id: "cause-7", total_amount_raised: 640 }),
                fundraiser({ region_public_id: "cause-1", total_amount_raised: 160 }),
            );
            // Fundraisers plus 400 donated directly to the event
            eventTotal = totalOf(fundraisers) + 400;

            const data = await getLatestData(createEnv());
            const causeSum = data.causes.reduce((sum, cause) => sum + cause.raised, 0);

            expect(data.raised).toBe(eventTotal);
            expect(causeSum).toBeCloseTo(eventTotal, 2);
        });

        it("records the part of each cause's total given to it directly", async () => {
            fundraisers.push(
                fundraiser({ region_public_id: "cause-1", total_amount_raised: 300 }),
                fundraiser({ region_public_id: ALL_CHARITIES_REGION_ID, total_amount_raised: 80 }),
            );
            // Fundraisers plus 160 donated directly to the event
            eventTotal = 540;

            const causes = (await getLatestData(createEnv())).causes;

            expect(causes.find(cause => cause.id === "cause-1")).toMatchObject({ raised: 330, raisedDirect: 300 });
            expect(causes.find(cause => cause.id === "cause-2")).toMatchObject({ raised: 30, raisedDirect: 0 });
        });

        it("counts a manual adjustment as given directly to its cause", async () => {
            fundraisers.push(fundraiser({ region_public_id: ALL_CHARITIES_REGION_ID, total_amount_raised: 800 }));
            eventTotal = 800;

            const causes = (await getLatestData(createEnv({ "cause-1": 80 }))).causes;

            expect(causes.find(cause => cause.id === "cause-1")).toMatchObject({ raised: 170, raisedDirect: 80 });
            expect(causes.find(cause => cause.id === "cause-2")).toMatchObject({ raised: 90, raisedDirect: 0 });
        });

        it("breaks down a team event's total into its own donations and its supporting campaigns'", async () => {
            const teamEvent = fundraiser({ type: "team_event", region_public_id: "cause-1", amount_raised: 100, total_amount_raised: 400 });
            const supporting = fundraiser({ region_public_id: "cause-2", team_event_public_id: teamEvent.id, total_amount_raised: 300 });
            fundraisers.push(teamEvent, supporting);
            eventTotal = 400;

            const list = (await getLatestData(createEnv())).campaigns.list;

            expect(list.find(campaign => campaign.id === teamEvent.id)?.raisedBreakdown).toEqual({ teamEvent: 100, campaigns: 300 });
            expect(list.find(campaign => campaign.id === supporting.id)).not.toHaveProperty("raisedBreakdown");
        });
    });
});
