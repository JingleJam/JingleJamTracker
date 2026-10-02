import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TiltifyData } from "tiltify-cache/do/tiltifyData";
import { ApiResponse } from "tiltify-cache/types/ApiResponse";
import { Campaign } from "tiltify-cache/types/Campaign";
import { Env } from "tiltify-cache/types/env";

/*
    Tests for the TiltifyData Durable Object's API routes.

    The summary and campaign list are seeded as if restored from storage after a cold start, so no refresh runs.
    Only the live Tiltify data for single campaigns and team events is fetched, from a fake Tiltify.
*/

const YEAR = 2026;
const CAUSE_ID = "cause-1";

let nextId = 0;
let tiltifyCalls: string[] = [];
let failTiltify = false;

function campaign(overrides: Partial<Campaign> = {}): Campaign {
    const id = `campaign-${nextId++}`;
    return {
        id,
        slug: id,
        name: id,
        description: "",
        url: `https://tiltify.com/@user/${id}`,
        causeId: null,
        startTime: null,
        raised: 0,
        goal: 0,
        live: false,
        donationMatchMultiplier: 1,
        type: "campaign",
        team: null,
        teamEventId: null,
        user: { name: `user-${id}`, slug: `user-${id}`, avatar: "", url: "" },
        ...overrides,
    };
}

function summary(): ApiResponse {
    return {
        date: new Date("2026-12-05T12:00:00.000Z"),
        event: { year: YEAR, start: new Date("2026-12-01T17:00:00.000Z"), end: new Date("2026-12-15T08:00:00.000Z") },
        dollarConversionRate: 1.3,
        raised: 1000,
        collections: { redeemed: 10, total: 100 },
        donations: 20,
        history: [],
        causes: [{ id: CAUSE_ID, slug: "war-child", name: "War Child", logo: "", borderedLogo: "", description: "", color: "", url: "", donateUrl: "", raised: 1000, campaigns: 1, live: 0 }],
        campaigns: { count: 0, live: 0, list: [] },
    };
}

// A Tiltify fact with one reward of its own, the Jingle Jam collection, and an active and an ended donation match
function fact(id: string) {
    return {
        id,
        teamMemberCount: 4,
        social: { __typename: "Social", twitch: "https://twitch.tv/example", youtube: null, discord: null, facebook: null, instagram: null, linkedin: null, snapchat: null, tiktok: null, twitter: null, website: null },
        donationMatches: [
            { id: "match-active", active: true, matchedBy: "A Sponsor", pledgedAmount: { value: "500.00" }, totalAmountRaised: { value: "120.50" }, startsAt: "2026-12-05T10:00:00Z", endsAt: "2026-12-05T14:00:00Z" },
            { id: "match-ended", active: false, matchedBy: "Old Sponsor", pledgedAmount: { value: "100.00" }, totalAmountRaised: { value: "100.00" }, startsAt: null, endsAt: null },
        ],
        rewards: [
            { id: "reward-collection", name: "Jingle Jam Collection 2026", active: true, ownerUsageType: "fundraising_event_activation", amount: { value: "35.00" }, quantity: 100, remaining: 90 },
            { id: "reward-own", name: "Shout-out", description: "Read out on stream", active: true, ownerUsageType: "campaign", amount: { value: "10.00" }, quantity: null, remaining: null, image: { src: "https://example.com/reward.png" }, startsAt: null, endsAt: null },
            { id: "reward-ended", name: "Old Reward", active: false, ownerUsageType: "campaign", amount: { value: "5.00" } },
        ],
    };
}

async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = input.toString();
    const body = init?.body ? JSON.parse(init.body as string) : null;

    if (url === "https://api.tiltify.com/") {
        tiltifyCalls.push(body.operationName);
        if (failTiltify) {
            return new Response("Bad Gateway", { status: 502 });
        }
        if (body.operationName === "get_default_template_fact") {
            return Response.json({ data: { fact: fact(body.variables.id) } });
        }
        if (body.operationName === "get_default_template_fact_leaderboards") {
            return Response.json({
                data: {
                    fact: {
                        donorLeaderboard: {
                            entries: { edges: [{ node: { name: "Big Donor", amount: { value: "250.00" } } }, { node: { name: "Anonymous", amount: { value: "35.5" } } }] },
                        },
                    },
                },
            });
        }
    }

    throw new Error(`Unexpected fetch: ${url}`);
}

async function createTiltifyData(campaigns: Campaign[]): Promise<TiltifyData> {
    const storage = {
        get: async (key: string) => key === `tiltify-data-${YEAR}` ? summary() : undefined,
        put: async () => {},
        delete: async () => {},
        getAlarm: async () => null,
        setAlarm: () => {},
    };
    const kv: Record<string, string> = { [`campaigns-${YEAR}`]: JSON.stringify(campaigns) };

    const env = {
        YEAR,
        CAUSE_SLUG: "jingle-jam",
        FUNDRAISER_PUBLIC_ID: "event-2026",
        ENABLE_REFRESH: false,
        JINGLE_JAM_DATA: { get: async (key: string, type?: string) => kv[key] ? (type === "json" ? JSON.parse(kv[key]) : kv[key]) : null },
    } as unknown as Env;

    let ready: Promise<unknown> = Promise.resolve();
    const state = { storage, blockConcurrencyWhile: (fn: () => Promise<unknown>) => (ready = fn()) };

    const tiltifyData = new TiltifyData(state as unknown as DurableObjectState, env);
    await ready;
    return tiltifyData;
}

async function get(tiltifyData: TiltifyData, path: string): Promise<{ status: number; body: any }> {
    const response = await tiltifyData.fetch(new Request("http://127.0.0.1" + path));
    return { status: response.status, body: await response.json() };
}

describe("TiltifyData", () => {
    // Highest raised first, as the campaign list is stored
    let teamEvent: Campaign;
    let supporting: Campaign;
    let teamCampaign: Campaign;
    let plain: Campaign;
    let campaigns: Campaign[];
    let tiltifyData: TiltifyData;

    beforeEach(async () => {
        nextId = 0;
        tiltifyCalls = [];
        failTiltify = false;
        vi.stubGlobal("fetch", vi.fn(fakeFetch));
        vi.spyOn(console, "log").mockImplementation(() => {});

        teamEvent = campaign({ name: "Team Event", type: "team_event", raised: 900, team: { name: "The Team", slug: "the-team", avatar: "", url: "" } });
        supporting = campaign({ name: "Supporting Stream", raised: 600, live: true, teamEventId: teamEvent.id });
        teamCampaign = campaign({ name: "Team Campaign", raised: 400, causeId: CAUSE_ID, team: { name: "Another Team", slug: "another-team", avatar: "", url: "" } });
        plain = campaign({ name: "Christmas Stream", raised: 200 });
        campaigns = [teamEvent, supporting, teamCampaign, plain];
        tiltifyData = await createTiltifyData(campaigns);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("serves the summary", async () => {
        const { status, body } = await get(tiltifyData, "/api/summary");

        expect(status).toBe(200);
        expect(body.raised).toBe(1000);
        expect(body.event.year).toBe(YEAR);
    });

    it("lists the causes with the shared response fields", async () => {
        const { status, body } = await get(tiltifyData, "/api/causes");

        expect(status).toBe(200);
        expect(body.date).toBe("2026-12-05T12:00:00.000Z");
        expect(body.event).toEqual({ year: YEAR, start: "2026-12-01T17:00:00.000Z", end: "2026-12-15T08:00:00.000Z" });
        expect(body.dollarConversionRate).toBe(1.3);
        expect(body.causes.map((cause: any) => cause.slug)).toEqual(["war-child"]);
    });

    describe("campaign list", () => {
        it("returns 20 campaigns by default, with the shared response fields", async () => {
            const many = Array.from({ length: 30 }, () => campaign());
            const { body } = await get(await createTiltifyData(many), "/api/campaigns");

            expect(body.date).toBe("2026-12-05T12:00:00.000Z");
            expect(body.event.year).toBe(YEAR);
            expect(body.campaigns).toHaveLength(20);
            expect(body).toMatchObject({ total: 30, limit: 20, offset: 0 });
        });

        it("pages with limit and offset", async () => {
            const { body } = await get(tiltifyData, "/api/campaigns?limit=2&offset=1");

            expect(body.campaigns.map((c: Campaign) => c.id)).toEqual([supporting.id, teamCampaign.id]);
            expect(body).toMatchObject({ total: 4, limit: 2, offset: 1 });
        });

        it("rejects an invalid limit, offset, type or search", async () => {
            expect((await get(tiltifyData, "/api/campaigns?limit=0")).status).toBe(400);
            expect((await get(tiltifyData, "/api/campaigns?limit=101")).status).toBe(400);
            expect((await get(tiltifyData, "/api/campaigns?offset=-1")).status).toBe(400);
            expect((await get(tiltifyData, "/api/campaigns?type=auction")).status).toBe(400);
            expect((await get(tiltifyData, "/api/campaigns?search=" + "a".repeat(101))).status).toBe(400);
        });

        it("filters by type", async () => {
            const ids = async (type: string) => (await get(tiltifyData, `/api/campaigns?type=${type}`)).body.campaigns.map((c: Campaign) => c.id);

            expect(await ids("campaign")).toEqual([supporting.id, plain.id]);
            expect(await ids("team_campaign")).toEqual([teamCampaign.id]);
            expect(await ids("team_event")).toEqual([teamEvent.id]);
            expect(await ids("team_campaign,team_event")).toEqual([teamEvent.id, teamCampaign.id]);
        });

        it("searches, counting only the matches in the total", async () => {
            const { body } = await get(tiltifyData, "/api/campaigns?search=chrismas");

            expect(body.campaigns.map((c: Campaign) => c.id)).toEqual([plain.id]);
            expect(body.total).toBe(1);
        });
    });

    describe("single campaign", () => {
        it("returns the campaign with live data from Tiltify", async () => {
            const { status, body } = await get(tiltifyData, `/api/campaigns/${teamCampaign.id}`);

            expect(status).toBe(200);
            expect(body.date).toBe("2026-12-05T12:00:00.000Z");
            expect(body.campaign).toEqual(teamCampaign);
            expect(body.social.twitch).toBe("https://twitch.tv/example");
            expect(body.social.youtube).toBeNull();
            expect(body.donationMatches).toEqual([
                { id: "match-active", matchedBy: "A Sponsor", pledged: 500, matched: 120.5, startsAt: "2026-12-05T10:00:00Z", endsAt: "2026-12-05T14:00:00Z" },
            ]);
            expect(body.rewards).toEqual([
                { id: "reward-own", name: "Shout-out", description: "Read out on stream", image: "https://example.com/reward.png", amount: 10, quantity: null, remaining: null, startsAt: null, endsAt: null },
            ]);
            expect(body.topDonors).toEqual([{ name: "Big Donor", amount: 250 }, { name: "Anonymous", amount: 35.5 }]);
            expect(body).not.toHaveProperty("teamMemberCount");
        });

        it("looks up the id without case sensitivity", async () => {
            expect((await get(tiltifyData, `/api/campaigns/${plain.id.toUpperCase()}`)).status).toBe(200);
        });

        it("points a team event's id to the team event endpoint", async () => {
            const { status, body } = await get(tiltifyData, `/api/campaigns/${teamEvent.id}`);

            expect(status).toBe(404);
            expect(body.error).toBe(`Campaign not found. This ID is a team event, use /api/team_events/${teamEvent.id}.`);
        });

        it("returns 404 for an unknown id without calling Tiltify", async () => {
            const { status, body } = await get(tiltifyData, "/api/campaigns/not-a-campaign");

            expect(status).toBe(404);
            expect(body.error).toBe("Campaign not found.");
            expect(tiltifyCalls).toEqual([]);
        });

        it("reuses the live data for 30 seconds", async () => {
            vi.useFakeTimers({ toFake: ["Date"] });
            vi.setSystemTime(new Date("2026-12-05T12:00:00Z"));

            await get(tiltifyData, `/api/campaigns/${plain.id}`);
            await get(tiltifyData, `/api/campaigns/${plain.id}`);
            expect(tiltifyCalls).toHaveLength(2);

            vi.setSystemTime(new Date("2026-12-05T12:00:30Z"));
            await get(tiltifyData, `/api/campaigns/${plain.id}`);
            expect(tiltifyCalls).toHaveLength(4);
        });

        it("shares one Tiltify fetch between concurrent requests", async () => {
            await Promise.all([1, 2, 3].map(() => get(tiltifyData, `/api/campaigns/${plain.id}`)));

            expect(tiltifyCalls).toHaveLength(2);
        });

        it("keeps the last live data when Tiltify fails", async () => {
            vi.useFakeTimers({ toFake: ["Date"] });
            vi.setSystemTime(new Date("2026-12-05T12:00:00Z"));
            vi.spyOn(console, "error").mockImplementation(() => {});

            const before = (await get(tiltifyData, `/api/campaigns/${plain.id}`)).body;

            failTiltify = true;
            vi.setSystemTime(new Date("2026-12-05T12:01:00Z"));
            const after = (await get(tiltifyData, `/api/campaigns/${plain.id}`)).body;

            expect(after.topDonors).toEqual(before.topDonors);
            expect(after.rewards).toEqual(before.rewards);
        });

        it("returns empty live data when Tiltify fails on the first fetch", async () => {
            failTiltify = true;
            vi.spyOn(console, "error").mockImplementation(() => {});

            const { status, body } = await get(tiltifyData, `/api/campaigns/${plain.id}`);

            expect(status).toBe(200);
            expect(body.campaign).toEqual(plain);
            expect(body.social.twitch).toBeNull();
            expect(body.donationMatches).toEqual([]);
            expect(body.rewards).toEqual([]);
            expect(body.topDonors).toEqual([]);
        });
    });

    describe("single team event", () => {
        it("returns the team event with its supporting campaigns and live data from Tiltify", async () => {
            const { status, body } = await get(tiltifyData, `/api/team_events/${teamEvent.id}`);

            expect(status).toBe(200);
            expect(body.teamEvent).toEqual(teamEvent);
            expect(body.teamMemberCount).toBe(4);
            expect(body.topDonors).toHaveLength(2);
            expect(body.rewards.map((reward: any) => reward.id)).toEqual(["reward-own"]);
            expect(body.campaigns).toEqual({ count: 1, live: 1, list: [supporting] });
        });

        it("points a campaign's id to the campaign endpoint", async () => {
            const { status, body } = await get(tiltifyData, `/api/team_events/${plain.id}`);

            expect(status).toBe(404);
            expect(body.error).toBe(`Team event not found. This ID is a campaign, use /api/campaigns/${plain.id}.`);
        });

        it("returns 404 for an unknown id", async () => {
            const { status, body } = await get(tiltifyData, "/api/team_events/not-a-team-event");

            expect(status).toBe(404);
            expect(body.error).toBe("Team event not found.");
        });
    });
});
