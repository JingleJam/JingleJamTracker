import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_CLOCK_KEY, DemoMode, getDemoMode, getEventLength } from "tiltify-cache/demo/clock";
import { DemoSource } from "tiltify-cache/demo/demoSource";
import { DEMO_TOTAL } from "tiltify-cache/demo/roster";
import { TiltifyData } from "tiltify-cache/do/tiltifyData";
import { GraphData } from "tiltify-cache/do/graphData";
import { ApiResponse } from "tiltify-cache/types/ApiResponse";
import { Env } from "tiltify-cache/types/env";
import causes2025 from "./fixtures/causes-2025.json";

/*
    Tests for the demo data (DEMO_MODE), generated without calling Tiltify.
    Time is faked, starting at NOW, which is when the demo is first requested.
*/

const YEAR = 2026;
const NOW = new Date("2026-10-05T12:00:00.000Z").getTime();
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const DAY = 24 * 60 * MINUTE;
const EVENT_LENGTH = getEventLength(YEAR);

let kv: Record<string, string>;
let kvPuts: string[];

function createEnv(mode: string): Env {
    return {
        YEAR,
        COLLECTIONS_AVAILABLE: 100000,
        DOLLAR_OFFSET: 0,
        DONATION_DIFFERENCE: 0,
        CONVERSION_RATE: 1.33,
        FUNDRAISER_PUBLIC_ID: "event",
        ALL_CHARITIES_REGION_ID: "all",
        YOGSCAST_USERNAME: "yogscast",
        LIVE_REFRESH_TIME: 10,
        ENABLE_REFRESH: false,
        GRAPH_REFRESH_TIME: 600,
        ENABLE_GRAPH_REFRESH: false,
        DEMO_MODE: mode,
        ADMIN_TOKEN: undefined,
        JINGLE_JAM_DATA: {
            get: async (key: string, type?: string) => key in kv ? (type === "json" ? JSON.parse(kv[key]) : kv[key]) : null,
            put: async (key: string, value: string) => { kvPuts.push(key); kv[key] = value; },
        } as unknown as KVNamespace,
        TILTIFY_DATA: {} as DurableObjectNamespace,
    };
}

function demo(mode: DemoMode): DemoSource {
    return new DemoSource(createEnv(mode), mode);
}

function advance(ms: number) {
    vi.setSystemTime(Date.now() + ms);
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe("demo", () => {
    beforeEach(() => {
        kv = { causes: JSON.stringify(causes2025), summary: "[]" };
        kvPuts = [];
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(NOW);
        vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => { throw new Error(`Unexpected fetch: ${input}`); }));
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe("DEMO_MODE", () => {
        it("is off when empty, and not case-sensitive", () => {
            expect(getDemoMode(createEnv(""))).toBeNull();
            expect(getDemoMode({ ...createEnv(""), DEMO_MODE: undefined })).toBeNull();
            expect(getDemoMode(createEnv(" Running "))).toBe("running");
        });

        it("rejects anything that isn't a mode, rather than calling Tiltify", () => {
            expect(() => getDemoMode(createEnv("start"))).toThrow(/Invalid DEMO_MODE "start"/);
        });
    });

    describe("starting", () => {
        it("starts the event 30 seconds after the first request, with everything blank until then", async () => {
            const source = demo("starting");
            const data = await source.getLatestData();

            expect(data.event.start.getTime()).toBe(NOW + 30 * SECOND);
            expect(data.event.end.getTime()).toBe(NOW + 30 * SECOND + EVENT_LENGTH);
            expect(data.raised).toBe(0);
            expect(data.donations).toBe(0);
            expect(data.collections.redeemed).toBe(0);
            expect(data.campaigns).toEqual({ count: 0, live: 0, list: [] });
            for (const cause of data.causes) {
                expect(cause).toMatchObject({ raised: 0, raisedDirect: 0, campaigns: 0, live: 0 });
            }

            advance(29 * SECOND);
            expect((await source.getLatestData()).campaigns.count).toBe(0);
        });

        it("publishes the team events, the edge cases and the first campaigns as the event starts", async () => {
            const source = demo("starting");
            await source.getLatestData();

            advance(30 * SECOND);
            const data = await source.getLatestData();

            expect(data.campaigns.count).toBeGreaterThan(100);
            expect(data.campaigns.count).toBeLessThan(200);
            expect(data.campaigns.list.filter(campaign => campaign.type === "team_event")).toHaveLength(6);
            expect(data.campaigns.list.some(campaign => campaign.name === "Always Live 24/7 Stream")).toBe(true);
            for (const campaign of data.campaigns.list) {
                expect(campaign.startTime).toBe(data.event.start.toISOString());
            }
        });

        it("raises money and goes live once the event starts", async () => {
            const source = demo("starting");
            await source.getLatestData();

            advance(10 * MINUTE);
            const data = await source.getLatestData();

            expect(data.raised).toBeGreaterThan(0);
            expect(data.campaigns.live).toBeGreaterThan(0);
            expect(data.donations).toBeGreaterThan(0);
        });
    });

    describe("running", () => {
        let data: ApiResponse;

        beforeEach(async () => {
            data = await demo("running").getLatestData();
        });

        it("is three days into the event", () => {
            expect(data.event.start.getTime()).toBe(NOW - 3 * DAY);
            expect(data.raised).toBeGreaterThan(DEMO_TOTAL * 0.3);
            expect(data.raised).toBeLessThan(DEMO_TOTAL);
        });

        it("splits the total across the causes", () => {
            expect(sum(data.causes.map(cause => cause.raised))).toBeCloseTo(data.raised, 0);
            for (const cause of data.causes) {
                expect(cause.raisedDirect).toBeLessThanOrEqual(cause.raised);
            }
        });

        it("counts each cause's campaigns, leaving the last cause with none of its own", () => {
            for (const cause of data.causes) {
                const campaigns = data.campaigns.list.filter(campaign => campaign.causeId === cause.id);
                expect(cause.campaigns).toBe(campaigns.length);
                expect(cause.live).toBe(campaigns.filter(campaign => campaign.live).length);
            }
            expect(data.causes[data.causes.length - 1].campaigns).toBe(0);
            expect(data.campaigns.list.some(campaign => campaign.causeId === null)).toBe(true);
        });

        it("adds a team event's supporting campaigns to its total", () => {
            const teamEvents = data.campaigns.list.filter(campaign => campaign.type === "team_event");
            expect(teamEvents.length).toBeGreaterThan(1);

            for (const teamEvent of teamEvents) {
                const supporting = data.campaigns.list.filter(campaign => campaign.teamEvent?.id === teamEvent.id);
                expect(supporting.length).toBeGreaterThan(0);
                expect(teamEvent.raisedBreakdown!.campaigns).toBeCloseTo(sum(supporting.map(campaign => campaign.raised)), 1);
                expect(teamEvent.raised).toBeCloseTo(teamEvent.raisedBreakdown!.teamEvent + teamEvent.raisedBreakdown!.campaigns, 1);
            }
        });

        it("sorts the campaigns by amount raised and counts the live ones", () => {
            const raised = data.campaigns.list.map(campaign => campaign.raised);
            expect(raised).toEqual([...raised].sort((a, b) => b - a));
            expect(data.campaigns.live).toBe(data.campaigns.list.filter(campaign => campaign.live).length);
        });

        it("includes the edge cases", () => {
            const byName = (name: string) => data.campaigns.list.find(campaign => campaign.name.startsWith(name))!;

            expect(byName("An Incredibly Long").description.endsWith("...")).toBe(true);
            expect(byName("Nothing Raised Yet").raised).toBe(0);
            expect(byName("No Goal Stream").goal).toBe(0);
            expect(byName("Smashed It").raised).toBeGreaterThan(byName("Smashed It").goal);
            expect(byName("Always Live").live).toBe(true);
            expect(byName("Never Live").live).toBe(false);
            expect(byName("No Avatar").user.avatar).toBe("");
            expect(new Set(data.campaigns.list.map(campaign => campaign.donationMatchMultiplier))).toEqual(new Set([1, 2, 3]));
            expect(data.campaigns.list.some(campaign => campaign.team && !campaign.teamEvent && campaign.type === "campaign")).toBe(true);
        });

        it("keeps the history from KV", async () => {
            kv.summary = JSON.stringify([{ year: 2025, event: { start: "", end: "" }, total: { dollars: 1, pounds: 1 }, donations: 1 }]);
            expect((await demo("running").getLatestData()).history).toHaveLength(1);
        });
    });

    describe("ending", () => {
        it("ends the event 30 seconds after the first request, then stops changing", async () => {
            const source = demo("ending");
            const before = await source.getLatestData();

            expect(before.event.end.getTime()).toBe(NOW + 30 * SECOND);
            expect(before.event.start.getTime()).toBe(NOW + 30 * SECOND - EVENT_LENGTH);
            expect(before.raised).toBeLessThan(DEMO_TOTAL);

            advance(31 * SECOND);
            const ended = await source.getLatestData();
            expect(ended.raised).toBeCloseTo(DEMO_TOTAL, -1);
            expect(ended.campaigns.live).toBe(0);

            advance(DAY);
            expect((await source.getLatestData()).raised).toBe(ended.raised);
        });
    });

    describe("over time", () => {
        // A demo that started at NOW, `hours` into the event
        async function at(hours: number): Promise<ApiResponse> {
            const source = demo("starting");
            await source.getLatestData();
            vi.setSystemTime(NOW + 30 * SECOND + hours * 60 * MINUTE);
            return source.getLatestData();
        }

        it("publishes more campaigns as the event goes on, each raising nothing before it is published", async () => {
            const source = demo("starting");
            const counts: number[] = [];
            for (const hours of [0, 1, 24, 72, 7 * 24, 13 * 24]) {
                vi.setSystemTime(NOW + 30 * SECOND + hours * 60 * MINUTE);
                const data = await source.getLatestData();
                counts.push(data.campaigns.count);
                for (const campaign of data.campaigns.list) {
                    expect(new Date(campaign.startTime!).getTime()).toBeLessThanOrEqual(Date.now());
                }
            }

            expect(counts).toEqual([...counts].sort((a, b) => a - b));
            expect(counts[counts.length - 1]).toBeGreaterThan(counts[0] * 2);

            const newest = (await at(24)).campaigns.list.reduce((a, b) => a.startTime! > b.startTime! ? a : b);
            expect(newest.raised).toBeLessThan(newest.goal || Infinity);
        });

        it("has more live in the evening than in the morning, in the event's time of day from 17:00", async () => {
            const evening = await at(27);   // 20:00 on the second day
            const morning = await at(39);   // 08:00 on the third day

            expect(evening.campaigns.live).toBeGreaterThan(morning.campaigns.live * 2);
        });

        it("keeps streams live for a while rather than changing every refresh", async () => {
            const before = new Set((await at(26)).campaigns.list.filter(campaign => campaign.live).map(campaign => campaign.id));
            advance(MINUTE);
            const after = (await demo("starting").getLatestData()).campaigns.list.filter(campaign => campaign.live);

            const stillLive = after.filter(campaign => before.has(campaign.id)).length;
            expect(stillLive).toBeGreaterThan(before.size * 0.8);
        });

        it("has most campaigns past their goal by the middle of the event, and nearly all by the end", async () => {
            const reached = (data: ApiResponse) => {
                const withGoal = data.campaigns.list.filter(campaign => campaign.goal > 0);
                return withGoal.filter(campaign => campaign.raised >= campaign.goal).length / withGoal.length;
            };

            expect(reached(await at(24))).toBeLessThan(0.3);
            expect(reached(await at(7 * 24))).toBeGreaterThan(0.5);
            expect(reached(await at(14 * 24))).toBeGreaterThan(0.95);
        });
    });

    it("only ever raises the total", async () => {
        const source = demo("starting");
        let last = 0;
        for (const step of [0, 31 * SECOND, MINUTE, 10 * MINUTE, 3 * 60 * MINUTE, 5 * DAY, 9 * DAY]) {
            advance(step);
            const data = await source.getLatestData();
            expect(data.raised).toBeGreaterThanOrEqual(last);
            last = data.raised;
        }
    });

    describe("clock", () => {
        it("is shared between instances through KV, so every Durable Object shows the same event", async () => {
            const first = await demo("starting").getLatestData();
            advance(5 * MINUTE);
            const second = await demo("starting").getLatestData();

            expect(second.event.start).toEqual(first.event.start);
            const secondIds = new Set(second.campaigns.list.map(campaign => campaign.id));
            expect(first.campaigns.list.every(campaign => secondIds.has(campaign.id))).toBe(true);
        });

        it("starts again when the mode changes", async () => {
            await demo("starting").getLatestData();
            advance(5 * MINUTE);

            const data = await demo("ending").getLatestData();
            expect(data.event.end.getTime()).toBe(NOW + 5 * MINUTE + 30 * SECOND);
        });

        it("starts again when `npm run seed` clears it", async () => {
            const source = demo("starting");
            await source.getLatestData();

            advance(5 * MINUTE);
            kv[DEMO_CLOCK_KEY] = "null";
            const data = await source.getLatestData();

            expect(data.event.start.getTime()).toBe(NOW + 5 * MINUTE + 30 * SECOND);
            expect(data.raised).toBe(0);
        });
    });

    describe("timeline", () => {
        it("has a point every GRAPH_REFRESH_TIME from the start, matching the total at that time", async () => {
            const source = demo("running");
            const points = await source.getTimeline();
            const start = NOW - 3 * DAY;

            expect(points[0]).toEqual({ date: start, p: 0, d: 0 });
            expect(points).toHaveLength(3 * 24 * 6 + 1);
            for (let i = 1; i < points.length; i++) {
                expect(points[i].date - points[i - 1].date).toBe(10 * MINUTE);
                expect(points[i].p).toBeGreaterThanOrEqual(points[i - 1].p);
            }

            const last = points[points.length - 1];
            expect(last.date).toBe(NOW);
            expect(last.p).toBe((await source.getLatestData()).raised);
            expect(last.d).toBeCloseTo(last.p * 1.33, 1);
        });

        it("only has the starting point before the event", async () => {
            expect(await demo("starting").getTimeline()).toEqual([{ date: NOW + 30 * SECOND, p: 0, d: 0 }]);
        });

        it("adds points as time passes and stops at the end", async () => {
            const source = demo("ending");
            const before = (await source.getTimeline()).length;

            advance(DAY);
            const points = await source.getTimeline();
            expect(points.length).toBeGreaterThanOrEqual(before);
            expect(points[points.length - 1].date).toBeLessThanOrEqual(NOW + 30 * SECOND);
        });
    });

    describe("campaign details", () => {
        let source: DemoSource;
        let data: ApiResponse;

        beforeEach(async () => {
            source = demo("running");
            data = await source.getLatestData();
        });

        it("has one donation match for each extra multiplier, matched up to its pledge", async () => {
            for (const campaign of data.campaigns.list.slice(0, 50)) {
                const details = await source.getFactDetails(campaign.id);
                expect(details.donationMatches).toHaveLength(campaign.donationMatchMultiplier - 1);
                for (const match of details.donationMatches) {
                    expect(match.matched).toBeLessThanOrEqual(match.pledged);
                }
            }
        });

        it("gives team events a member count and campaigns none", async () => {
            const teamEvent = data.campaigns.list.find(campaign => campaign.type === "team_event")!;
            const supporting = data.campaigns.list.filter(campaign => campaign.teamEvent?.id === teamEvent.id);

            expect((await source.getFactDetails(teamEvent.id)).teamMemberCount).toBeGreaterThanOrEqual(supporting.length);
            expect((await source.getFactDetails(supporting[0].id)).teamMemberCount).toBeNull();
        });

        it("includes fundraisers with their donor leaderboard turned off, and sold out rewards", async () => {
            const details = await Promise.all(data.campaigns.list.map(campaign => source.getFactDetails(campaign.id)));

            expect(details.some(d => d.topDonors === null)).toBe(true);
            expect(details.some(d => d.rewards.some(reward => reward.remaining === 0))).toBe(true);
            expect(details.some(d => d.rewards.some(reward => reward.quantity === null))).toBe(true);
            expect(details.some(d => Object.values(d.social).every(value => value === null))).toBe(true);
        });

        it("lists the top donors largest first", async () => {
            const details = await source.getFactDetails(data.campaigns.list[0].id);
            const amounts = details.topDonors!.map(donor => donor.amount);

            expect(amounts.length).toBe(25);
            expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
        });

        it("adds new donations to the top of the latest donations as the amount raised grows", async () => {
            const id = data.campaigns.list[0].id;
            const before = (await source.getFactDetails(id)).latestDonations;

            advance(DAY);
            const after = (await source.getFactDetails(id)).latestDonations;

            expect(before).toHaveLength(25);
            expect(after).toHaveLength(25);
            expect(after).not.toEqual(before);
        });

        it("returns empty details for an unknown id", async () => {
            const details = await source.getFactDetails("unknown");
            expect(details.donationMatches).toEqual([]);
            expect(details.teamMemberCount).toBeNull();
        });
    });

    describe("Durable Objects", () => {
        let storagePuts: string[];

        function createState() {
            storagePuts = [];
            const storage = {
                get: async () => undefined,
                put: async (key: string) => { storagePuts.push(key); },
                delete: async () => {},
                getAlarm: async () => null,
                setAlarm: () => {},
            };
            let ready: Promise<unknown> = Promise.resolve();
            const state = { storage, blockConcurrencyWhile: (fn: () => Promise<unknown>) => (ready = fn()) };
            return { state: state as unknown as DurableObjectState, ready: () => ready };
        }

        async function get(target: { fetch(request: Request): Promise<Response> }, path: string) {
            const response = await target.fetch(new Request("http://127.0.0.1" + path));
            return { status: response.status, body: await response.json() as any };
        }

        it("serves the demo from TiltifyData without calling Tiltify or saving snapshots", async () => {
            const { state, ready } = createState();
            const tiltifyData = new TiltifyData(state, createEnv("running"));
            await ready();

            const event = await get(tiltifyData, "/api/v1/event");
            expect(event.status).toBe(200);
            expect(event.body.meta.event.startsAt).toBe(new Date(NOW - 3 * DAY).toISOString());
            expect(event.body.campaigns.items).toHaveLength(25);

            const teamEventId = event.body.campaigns.items.find((campaign: any) => campaign.type === "team_event").id;
            const teamEvent = await get(tiltifyData, `/api/v1/campaigns/${teamEventId}`);
            expect(teamEvent.status).toBe(200);
            expect(teamEvent.body.campaigns.total).toBeGreaterThan(0);
            expect(teamEvent.body.latestDonations.length).toBeGreaterThan(0);

            expect(fetch).not.toHaveBeenCalled();
            expect(storagePuts).toEqual([]);
            expect(kvPuts).toEqual([DEMO_CLOCK_KEY]);
        });

        it("serves the demo timeline from GraphData without saving it", async () => {
            const { state } = createState();
            const graphData = new GraphData(state, createEnv("running"));

            const timeline = await get(graphData, "/api/v1/timeline");
            expect(timeline.status).toBe(200);
            expect(timeline.body[0]).toEqual({ date: NOW - 3 * DAY, p: 0, d: 0 });
            expect(storagePuts).toEqual([]);
        });
    });
});
