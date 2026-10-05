import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TiltifyData } from "tiltify-cache/do/tiltifyData";
import { ApiResponse } from "tiltify-cache/types/ApiResponse";
import { Campaign } from "tiltify-cache/types/Campaign";
import { Env } from "tiltify-cache/types/env";
import { getCampaign } from "tiltify-cache/responses";

/*
    Tests for the TiltifyData Durable Object's API routes.

    The summary (in its internal format) and campaign list are seeded as if restored from storage after a cold start, so no refresh runs.
    Only the live Tiltify data for single campaigns and team events is fetched, from a fake Tiltify.
*/

const YEAR = 2026;
const CAUSE_ID = "cause-1";
const ADMIN_TOKEN = "admin-secret";

let nextId = 0;
let tiltifyCalls: string[] = [];
let failTiltify = false;
let donorLeaderboardOff = false;
let storedSummary: ApiResponse | null = null;   // The last summary written to Durable Object storage

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
        teamEvent: null,
        user: { name: `user-${id}`, slug: `user-${id}`, avatar: "", url: "" },
        ...overrides,
    };
}

// The summary in its internal format, as stored after a refresh, holding the top 100 campaigns
function summary(campaigns: Campaign[]): ApiResponse {
    return {
        date: new Date("2026-12-05T12:00:00.000Z"),
        event: { year: YEAR, start: new Date("2026-12-01T17:00:00.000Z"), end: new Date("2026-12-15T08:00:00.000Z") },
        dollarConversionRate: 1.3,
        raised: 1000,
        collections: { redeemed: 10, total: 100 },
        donations: 20,
        history: [{ year: 2025, event: { start: "2025-12-01T17:00:00.000Z", end: "2025-12-15T08:00:00.000Z" }, total: { dollars: 1300, pounds: 1000 }, donations: 50 }],
        causes: [{ id: CAUSE_ID, slug: "war-child", name: "War Child", logo: "logo.webp", borderedLogo: "bordered.webp", description: "", color: "#cc232a", url: "", donateUrl: "", override: 5, raised: 1000, raisedDirect: 400, campaigns: 1, live: 0 }],
        campaigns: { count: campaigns.length, live: campaigns.filter(c => c.live).length, list: campaigns.slice(0, 100) },
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
        if (body.operationName === "get_fact_donations_by_id_asc") {
            return Response.json({
                data: {
                    fact: {
                        donations: {
                            edges: [
                                { node: { donorName: "Newest Donor", donorComment: "Good luck!", amount: { value: "20.00" } } },
                                { node: { donorName: "Anonymous", donorComment: null, amount: { value: "5.5" } } },
                            ],
                        },
                    },
                },
            });
        }
        if (body.operationName === "get_default_template_fact_leaderboards") {
            return Response.json({
                data: {
                    fact: {
                        donorLeaderboard: donorLeaderboardOff ? null : {
                            entries: { edges: [{ node: { name: "Big Donor", amount: { value: "250.00" } } }, { node: { name: "Anonymous", amount: { value: "35.5" } } }] },
                        },
                    },
                },
            });
        }
    }

    throw new Error(`Unexpected fetch: ${url}`);
}

async function createTiltifyData(campaigns: Campaign[], initialSummary: ApiResponse | null = summary(campaigns)): Promise<TiltifyData> {
    const storage = {
        get: async (key: string) => key === `tiltify-data-${YEAR}` ? initialSummary ?? undefined : undefined,
        put: async (key: string, value: ApiResponse) => { if (key === `tiltify-data-${YEAR}`) storedSummary = value; },
        delete: async () => {},
        getAlarm: async () => null,
        setAlarm: () => {},
    };
    const kv: Record<string, string> = { [`campaigns-${YEAR}`]: JSON.stringify(campaigns) };

    const env = {
        YEAR,
        FUNDRAISER_PUBLIC_ID: "event-2026",
        ENABLE_REFRESH: false,
        ADMIN_TOKEN,
        JINGLE_JAM_DATA: { get: async (key: string, type?: string) => kv[key] ? (type === "json" ? JSON.parse(kv[key]) : kv[key]) : null },
    } as unknown as Env;

    let ready: Promise<unknown> = Promise.resolve();
    const state = { storage, blockConcurrencyWhile: (fn: () => Promise<unknown>) => (ready = fn()) };

    const tiltifyData = new TiltifyData(state as unknown as DurableObjectState, env);
    await ready;
    return tiltifyData;
}

// A campaign as the v1 API shows it
function publicCampaign(campaign: Campaign) {
    return getCampaign(campaign, summary([]).causes);
}

async function get(tiltifyData: TiltifyData, path: string, init?: RequestInit): Promise<{ status: number; body: any }> {
    const response = await tiltifyData.fetch(new Request("http://127.0.0.1" + path, init));
    return { status: response.status, body: await response.json() };
}

const META = {
    updatedAt: "2026-12-05T12:00:00.000Z",
    event: { year: YEAR, startsAt: "2026-12-01T17:00:00.000Z", endsAt: "2026-12-15T08:00:00.000Z" },
    dollarConversionRate: 1.3,
};

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
        donorLeaderboardOff = false;
        storedSummary = null;
        vi.stubGlobal("fetch", vi.fn(fakeFetch));
        vi.spyOn(console, "log").mockImplementation(() => {});

        teamEvent = campaign({ name: "Team Event", type: "team_event", raised: 900, raisedBreakdown: { teamEvent: 300, campaigns: 600 }, team: { name: "The Team", slug: "the-team", avatar: "", url: "" } });
        supporting = campaign({ name: "Supporting Stream", raised: 600, live: true, teamEvent: { id: teamEvent.id, name: teamEvent.name, slug: teamEvent.slug, avatar: "", url: teamEvent.url } });
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

    describe("event", () => {
        it("serves the totals, causes, history and top campaigns with the meta fields", async () => {
            const { status, body } = await get(tiltifyData, "/api/v1/event");

            expect(status).toBe(200);
            expect(body.meta).toEqual(META);
            expect(body.raised).toBe(1000);
            expect(body.raisedBreakdown).toEqual({ direct: 400, shared: 600 });
            expect(body.donations).toBe(20);
            expect(body.collections).toEqual({ redeemed: 10, total: 100 });
            expect(body.history).toEqual([{
                year: 2025,
                event: { startsAt: "2025-12-01T17:00:00.000Z", endsAt: "2025-12-15T08:00:00.000Z" },
                total: { dollars: 1300, pounds: 1000 },
                donations: 50,
            }]);
            expect(body.causes.map((cause: any) => cause.slug)).toEqual(["war-child"]);
            expect(body.causes[0].raisedBreakdown).toEqual({ direct: 400, shared: 600 });
            expect(body.causes[0]).not.toHaveProperty("override");
            expect(body.causes[0]).not.toHaveProperty("raisedDirect");
            expect(body.campaigns).toEqual({ total: 4, live: 1, limit: 25, offset: 0, items: campaigns.map(publicCampaign) });
            expect(body).not.toHaveProperty("date");
        });

        it("includes only the top 25 campaigns, with counts for every campaign", async () => {
            const many = Array.from({ length: 30 }, () => campaign());
            const { body } = await get(await createTiltifyData(many), "/api/v1/event?limit=50");

            expect(body.campaigns.items).toHaveLength(25);
            expect(body.campaigns).toMatchObject({ total: 30, limit: 25, offset: 0 });
        });
    });

    it("lists the causes with the meta fields", async () => {
        const { status, body } = await get(tiltifyData, "/api/v1/causes");

        expect(status).toBe(200);
        expect(body.meta).toEqual(META);
        expect(body.causes.map((cause: any) => cause.slug)).toEqual(["war-child"]);
    });

    describe("single cause", () => {
        it("returns the cause and its top campaigns, by slug or id", async () => {
            for (const key of ["war-child", "WAR-CHILD", CAUSE_ID]) {
                const { status, body } = await get(tiltifyData, `/api/v1/causes/${key}`);

                expect(status).toBe(200);
                expect(body.meta).toEqual(META);
                expect(body.cause.name).toBe("War Child");
                expect(body.campaigns).toEqual({ total: 1, live: 0, limit: 25, offset: 0, items: [publicCampaign(teamCampaign)] });
                expect(body).not.toHaveProperty("raised");
                expect(body).not.toHaveProperty("scope");
            }
        });

        it("pages the campaigns with limit and offset", async () => {
            const { body } = await get(tiltifyData, "/api/v1/causes/war-child?limit=5&offset=1");

            expect(body.campaigns).toEqual({ total: 1, live: 0, limit: 5, offset: 1, items: [] });
        });

        it("returns 404 for an unknown cause, including the old whole-event slug", async () => {
            for (const key of ["not-a-cause", "jingle-jam"]) {
                const { status, body } = await get(tiltifyData, `/api/v1/causes/${key}`);

                expect(status).toBe(404);
                expect(body.error).toBe("Cause not found.");
            }
        });

        it("rejects an invalid limit", async () => {
            expect((await get(tiltifyData, "/api/v1/causes/war-child?limit=0")).status).toBe(400);
            expect((await get(tiltifyData, "/api/v1/causes/war-child?limit=101")).status).toBe(400);
        });
    });

    describe("campaign list", () => {
        it("returns 25 campaigns by default, with the meta fields", async () => {
            const many = Array.from({ length: 30 }, () => campaign());
            const { body } = await get(await createTiltifyData(many), "/api/v1/campaigns");

            expect(body.meta).toEqual(META);
            expect(body.campaigns.items).toHaveLength(25);
            expect(body.campaigns).toMatchObject({ total: 30, live: 0, limit: 25, offset: 0 });
        });

        it("pages with limit and offset", async () => {
            const { body } = await get(tiltifyData, "/api/v1/campaigns?limit=2&offset=1");

            expect(body.campaigns.items.map((c: Campaign) => c.id)).toEqual([supporting.id, teamCampaign.id]);
            expect(body.campaigns).toMatchObject({ total: 4, live: 1, limit: 2, offset: 1 });
        });

        it("rejects an invalid limit, offset, type, cause or search", async () => {
            expect((await get(tiltifyData, "/api/v1/campaigns?limit=0")).status).toBe(400);
            expect((await get(tiltifyData, "/api/v1/campaigns?limit=101")).status).toBe(400);
            expect((await get(tiltifyData, "/api/v1/campaigns?offset=-1")).status).toBe(400);
            expect((await get(tiltifyData, "/api/v1/campaigns?type=team_campaign")).status).toBe(400);
            expect((await get(tiltifyData, "/api/v1/campaigns?cause=not-a-cause")).status).toBe(400);
            expect((await get(tiltifyData, "/api/v1/campaigns?search=" + "a".repeat(101))).status).toBe(400);
        });

        it("filters by type", async () => {
            const ids = async (type: string) => (await get(tiltifyData, `/api/v1/campaigns?type=${type}`)).body.campaigns.items.map((c: Campaign) => c.id);

            expect(await ids("campaign")).toEqual([supporting.id, teamCampaign.id, plain.id]);
            expect(await ids("team_event")).toEqual([teamEvent.id]);
            expect(await ids("campaign,team_event")).toEqual([teamEvent.id, supporting.id, teamCampaign.id, plain.id]);
        });

        it("filters by cause slug or id", async () => {
            for (const cause of ["war-child", CAUSE_ID]) {
                const { body } = await get(tiltifyData, `/api/v1/campaigns?cause=${cause}`);

                expect(body.campaigns.items.map((c: Campaign) => c.id)).toEqual([teamCampaign.id]);
                expect(body.campaigns.total).toBe(1);
            }
        });

        it("searches, counting only the matches in the totals", async () => {
            const { body } = await get(tiltifyData, "/api/v1/campaigns?search=chrismas");

            expect(body.campaigns.items.map((c: Campaign) => c.id)).toEqual([plain.id]);
            expect(body.campaigns).toMatchObject({ total: 1, live: 0 });
        });
    });

    describe("campaign shape", () => {
        it("shows the cause a campaign supports, without the publish time", async () => {
            const { body } = await get(tiltifyData, `/api/v1/campaigns/${teamCampaign.id}`);

            expect(body.campaign.cause).toEqual({ id: CAUSE_ID, slug: "war-child", name: "War Child", color: "#cc232a" });
            expect(body.campaign).not.toHaveProperty("causeId");
            expect(body.campaign).not.toHaveProperty("startTime");
            expect(body.campaign).not.toHaveProperty("raisedBreakdown");
        });

        it("shows All The Charities for a campaign supporting every cause", async () => {
            const { body } = await get(tiltifyData, `/api/v1/campaigns/${plain.id}`);

            expect(body.campaign.cause).toEqual({ id: null, slug: null, name: "All The Charities", color: "#e21251" });
        });

        it("breaks down a team event's total into its own donations and its campaigns'", async () => {
            const { body } = await get(tiltifyData, `/api/v1/campaigns/${teamEvent.id}`);

            expect(body.campaign.raised).toBe(900);
            expect(body.campaign.raisedBreakdown).toEqual({ teamEvent: 300, campaigns: 600 });
        });
    });

    describe("single campaign", () => {
        it("returns the campaign with live data from Tiltify", async () => {
            const { status, body } = await get(tiltifyData, `/api/v1/campaigns/${teamCampaign.id}`);

            expect(status).toBe(200);
            expect(body.meta).toEqual(META);
            expect(body.campaign).toEqual(publicCampaign(teamCampaign));
            expect(body.social.twitch).toBe("https://twitch.tv/example");
            expect(body.social.youtube).toBeNull();
            expect(body.donationMatches).toEqual([
                { id: "match-active", matchedBy: "A Sponsor", pledged: 500, matched: 120.5, startsAt: "2026-12-05T10:00:00Z", endsAt: "2026-12-05T14:00:00Z" },
            ]);
            expect(body.rewards).toEqual([
                { id: "reward-own", name: "Shout-out", description: "Read out on stream", image: "https://example.com/reward.png", amount: 10, quantity: null, remaining: null, startsAt: null, endsAt: null },
            ]);
            expect(body.topDonors).toEqual([{ name: "Big Donor", amount: 250 }, { name: "Anonymous", amount: 35.5 }]);
            expect(body.latestDonations).toEqual([
                { name: "Newest Donor", amount: 20, comment: "Good luck!" },
                { name: "Anonymous", amount: 5.5, comment: null },
            ]);
            expect(body).not.toHaveProperty("teamMemberCount");
            expect(body).not.toHaveProperty("campaigns");
        });

        it("returns a team event with its supporting campaigns and member count", async () => {
            const { status, body } = await get(tiltifyData, `/api/v1/campaigns/${teamEvent.id}`);

            expect(status).toBe(200);
            expect(body.campaign).toEqual(publicCampaign(teamEvent));
            expect(body.teamMemberCount).toBe(4);
            expect(body.topDonors).toHaveLength(2);
            expect(body.latestDonations).toHaveLength(2);
            expect(body.rewards.map((reward: any) => reward.id)).toEqual(["reward-own"]);
            expect(body.campaigns).toEqual({ total: 1, live: 1, limit: 1, offset: 0, items: [publicCampaign(supporting)] });
        });

        it("returns null top donors when the donor leaderboard is turned off", async () => {
            donorLeaderboardOff = true;

            const { body } = await get(tiltifyData, `/api/v1/campaigns/${plain.id}`);

            expect(body.topDonors).toBeNull();
        });

        it("looks up the id without case sensitivity", async () => {
            expect((await get(tiltifyData, `/api/v1/campaigns/${plain.id.toUpperCase()}`)).status).toBe(200);
        });

        it("returns 404 for an unknown id without calling Tiltify", async () => {
            const { status, body } = await get(tiltifyData, "/api/v1/campaigns/not-a-campaign");

            expect(status).toBe(404);
            expect(body.error).toBe("Campaign not found.");
            expect(tiltifyCalls).toEqual([]);
        });

        it("reuses the live data for 30 seconds", async () => {
            vi.useFakeTimers({ toFake: ["Date"] });
            vi.setSystemTime(new Date("2026-12-05T12:00:00Z"));

            await get(tiltifyData, `/api/v1/campaigns/${plain.id}`);
            await get(tiltifyData, `/api/v1/campaigns/${plain.id}`);
            expect(tiltifyCalls).toHaveLength(3);

            vi.setSystemTime(new Date("2026-12-05T12:00:30Z"));
            await get(tiltifyData, `/api/v1/campaigns/${plain.id}`);
            expect(tiltifyCalls).toHaveLength(6);
        });

        it("shares one Tiltify fetch between concurrent requests", async () => {
            await Promise.all([1, 2, 3].map(() => get(tiltifyData, `/api/v1/campaigns/${plain.id}`)));

            expect(tiltifyCalls).toHaveLength(3);
        });

        it("keeps the last live data when Tiltify fails", async () => {
            vi.useFakeTimers({ toFake: ["Date"] });
            vi.setSystemTime(new Date("2026-12-05T12:00:00Z"));
            vi.spyOn(console, "error").mockImplementation(() => {});

            const before = (await get(tiltifyData, `/api/v1/campaigns/${plain.id}`)).body;

            failTiltify = true;
            vi.setSystemTime(new Date("2026-12-05T12:01:00Z"));
            const after = (await get(tiltifyData, `/api/v1/campaigns/${plain.id}`)).body;

            expect(after.topDonors).toEqual(before.topDonors);
            expect(after.latestDonations).toEqual(before.latestDonations);
            expect(after.rewards).toEqual(before.rewards);
        });

        it("returns empty live data when Tiltify fails on the first fetch", async () => {
            failTiltify = true;
            vi.spyOn(console, "error").mockImplementation(() => {});

            const { status, body } = await get(tiltifyData, `/api/v1/campaigns/${plain.id}`);

            expect(status).toBe(200);
            expect(body.campaign).toEqual(publicCampaign(plain));
            expect(body.social.twitch).toBeNull();
            expect(body.donationMatches).toEqual([]);
            expect(body.rewards).toEqual([]);
            expect(body.topDonors).toEqual([]);
            expect(body.latestDonations).toEqual([]);
        });
    });

    describe("admin summary update", () => {
        const post = (authorization?: string) => get(tiltifyData, "/api/v1/event", {
            method: "POST",
            headers: authorization ? { Authorization: authorization } : {},
            body: JSON.stringify({ ...summary(campaigns), raised: 5000 }),
        });

        it("accepts the admin token as is or as a Bearer token", async () => {
            for (const authorization of [ADMIN_TOKEN, `Bearer ${ADMIN_TOKEN}`]) {
                const { status, body } = await post(authorization);

                expect(status).toBe(200);
                expect(body).toEqual({ success: true });
                expect(storedSummary?.raised).toBe(5000);
                expect((await get(tiltifyData, "/api/v1/event")).body.raised).toBe(5000);
            }
        });

        it("accepts an edited event response", async () => {
            const event = (await get(tiltifyData, "/api/v1/event")).body;
            event.raised = 7500;
            event.meta.updatedAt = "2026-12-06T09:00:00.000Z";

            const { status } = await get(tiltifyData, "/api/v1/event", {
                method: "POST",
                headers: { Authorization: ADMIN_TOKEN },
                body: JSON.stringify(event),
            });

            expect(status).toBe(200);
            expect(storedSummary?.event.start).toEqual(new Date("2026-12-01T17:00:00.000Z"));
            expect(storedSummary?.history[0].event).toEqual({ start: "2025-12-01T17:00:00.000Z", end: "2025-12-15T08:00:00.000Z" });
            // The event's shared amount is worked out from its total, so it follows the edited total
            expect((await get(tiltifyData, "/api/v1/event")).body).toEqual({ ...event, raisedBreakdown: { direct: 400, shared: 7100 } });
            expect((await get(tiltifyData, "/api/tiltify")).body.raised).toBe(7500);
        });

        it("rejects a missing or wrong token with a JSON error", async () => {
            for (const authorization of [undefined, "wrong", "Bearer wrong"]) {
                const { status, body } = await post(authorization);

                expect(status).toBe(401);
                expect(body).toEqual({ error: "Unauthorized." });
            }
            expect(storedSummary).toBeNull();
        });
    });

    describe("errors", () => {
        it("returns a JSON 404 for an unknown path", async () => {
            const { status, body } = await get(tiltifyData, "/api/v1/not-an-endpoint");

            expect(status).toBe(404);
            expect(body).toEqual({ error: "Not found." });
        });

        it("returns a JSON 405 for a method an endpoint doesn't support", async () => {
            const { status, body } = await get(tiltifyData, "/api/v1/causes", { method: "POST" });

            expect(status).toBe(405);
            expect(body).toEqual({ error: "Method not allowed." });
        });

        it("returns a JSON 500 when a route fails", async () => {
            vi.spyOn(console, "error").mockImplementation(() => {});
            const broken = await createTiltifyData(campaigns, null);
            vi.spyOn(broken as any, "refresh").mockRejectedValue(new Error("Tiltify is down"));

            const { status, body } = await get(broken, "/api/v1/event");

            expect(status).toBe(500);
            expect(body).toEqual({ error: "Internal server error." });
        });
    });

    describe("2025 endpoints", () => {
        it("serves the summary in its 2025 shape at /api/tiltify", async () => {
            const { status, body } = await get(tiltifyData, "/api/tiltify");

            expect(status).toBe(200);
            expect(Object.keys(body)).toEqual(["date", "event", "dollarConversionRate", "raised", "collections", "donations", "history", "causes", "campaigns"]);
            expect(body.date).toBe("2026-12-05T12:00:00.000Z");
            expect(body.event).toEqual({ year: YEAR, start: "2026-12-01T17:00:00.000Z", end: "2026-12-15T08:00:00.000Z" });
            expect(body.history[0].event).toEqual({ start: "2025-12-01T17:00:00.000Z", end: "2025-12-15T08:00:00.000Z" });
            expect(body.causes).toEqual([{
                id: CAUSE_ID, name: "War Child", logo: "bordered.webp", description: "", color: "#cc232a", url: "", donateUrl: "", raised: 1000, campaigns: 1,
            }]);
            expect(Object.keys(body.campaigns)).toEqual(["count", "list"]);
            expect(body.campaigns.count).toBe(4);
            expect(Object.keys(body.campaigns.list[0])).toEqual(["causeId", "name", "description", "id", "slug", "url", "startTime", "raised", "goal", "type", "team", "user"]);
        });

        it("serves the campaign list in its 2025 shape at /api/campaigns, 100 per page by default", async () => {
            const many = Array.from({ length: 120 }, () => campaign());
            const { status, body } = await get(await createTiltifyData(many), "/api/campaigns?offset=10");

            expect(status).toBe(200);
            expect(Object.keys(body)).toEqual(["campaigns", "total", "limit", "offset"]);
            expect(body.campaigns).toHaveLength(100);
            expect(body).toMatchObject({ total: 120, limit: 100, offset: 10 });
            expect(body.campaigns[0]).not.toHaveProperty("live");
        });

        it("doesn't serve the old single campaign and admin paths", async () => {
            expect((await get(tiltifyData, `/api/campaigns/${plain.id}`)).status).toBe(404);
            expect((await get(tiltifyData, "/api/tiltify", { method: "POST", headers: { Authorization: ADMIN_TOKEN }, body: "{}" })).status).toBe(405);
        });
    });
});
