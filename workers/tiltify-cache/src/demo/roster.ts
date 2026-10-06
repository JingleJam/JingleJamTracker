import { truncateDescription } from "tiltify-cache/api";
import { Campaign } from "tiltify-cache/types/Campaign";
import { Cause } from "tiltify-cache/types/Cause";
import { Social } from "tiltify-cache/types/FactDetails";
import { generateSlug } from "tiltify-cache/utils";
import { between, chance, integer, niceAmount, pick, seededRandom, uuid } from "tiltify-cache/demo/random";
import * as words from "tiltify-cache/demo/words";

const SEED = 0x4a4a2026;
export const DEMO_TOTAL = 3_250_000; // What the demo event raises by its end (£)
const DIRECT_SHARE = 0.04; // Donated to the fundraising event itself rather than a campaign, so shared by every cause
const MAIN_TEAM_EVENT_SHARE = 0.22; // Donated to the biggest team event itself (its supporting campaigns are on top)
const RANDOM_CAMPAIGN_COUNT = 330;
const TEAM_EVENT_COUNT = 6; // The first teams in TEAM_NAMES run a team event, the rest don't
const ALL_CAUSES_CHANCE = 0.35; // Chance of a campaign supporting every cause instead of one
const PUBLISHED_AT_START_CHANCE = 0.4; // Chance of a campaign going up as the event starts, rather than during it
const MINUTE_MS = 60 * 1000;
const BROKEN_IMAGE = 'https://example.invalid/avatar.webp'; // An image that never loads, to check the fallbacks

// Chance of a fundraiser having each social link
const SOCIAL_CHANCES: [keyof Social, number][] = [
    ['twitch', 0.7], ['youtube', 0.4], ['twitter', 0.3], ['tiktok', 0.2], ['instagram', 0.2],
    ['discord', 0.15], ['website', 0.1], ['facebook', 0.05], ['snapchat', 0.03], ['linkedin', 0.02],
];

const REWARD_AMOUNTS = [5, 10, 15, 20, 25, 50, 100, 250];
const REWARD_QUANTITIES = [1, 5, 10, 25, 50, 100];

// A fundraiser's fields that don't change during the event
export type DemoCampaign = Omit<Campaign, 'startTime' | 'raised' | 'raisedBreakdown' | 'live'>;

export interface DemoMatch {
    id: string;
    matchedBy: string;
    pledged: number;
    untilEnd: boolean;      // Ends with the event, or has no end
}

export interface DemoReward {
    id: string;
    name: string;
    description: string;
    image: string | null;
    amount: number;
    quantity: number | null;
    sellRate: number;       // How quickly a limited reward is claimed. Over 1 sells out before the end, the fastest within a few days.
    untilEnd: boolean;      // Ends with the event, or has no end
}

export interface DemoFundraiser {
    seed: number;
    campaign: DemoCampaign;
    share: number;                  // What it raises itself by the end of the event (£). A team event's supporting campaigns are on top.
    peak: number;                   // When its big stream is, from 0 (when it is published, or the start of the event) to 1 (the end)
    liveChance: number;             // Chance of it being live at the busiest time of day, 1 for always and 0 for never
    streamLength: number;           // How long each stream lasts (ms)
    streamOffset: number;           // When its streams start, so they don't all start together (ms)
    publishedAt: number;            // When it was published, as a share of the event from its start (0 for as the event starts)
    supporting: DemoFundraiser[];   // A team event's supporting campaigns
    social: Social;
    matches: DemoMatch[];           // One for each extra donation match multiplier
    rewards: DemoReward[];
    donorLeaderboard: boolean;      // False to show a fundraiser that turned its donor leaderboard off
    topDonorShare: number;          // The top donor's share of the amount raised
    averageDonation: number;
    extraMembers: number;           // A team event's members without a supporting campaign
}

export interface DemoRoster {
    key: string;                    // The causes it was generated for
    fundraisers: DemoFundraiser[];
    byId: Map<string, DemoFundraiser>;  // By lowercase id
    direct: number;                 // Donated to the fundraising event itself by the end of the event (£)
}

interface Spec {
    name: string;
    type: Campaign['type'];
    causeId: string | null;
    username?: string;      // Campaigns only, a team event belongs to its team
    avatar?: string;
    team?: NonNullable<Campaign['team']>;
    description?: string;
    multiplier?: number;
    liveChance?: number;
    peak?: number;
    publishedAt?: number;   // Published at a random time when left out
    goal?: number;          // Set from the final amount when left out
    share?: number;         // A fixed share, otherwise it gets a part of what's left by its weight
    weight?: number;
}

interface Entry {
    fundraiser: DemoFundraiser;
    spec: Spec;
}

export function getRosterKey(causes: Cause[]): string {
    return causes.map(cause => `${cause.id}|${cause.borderedLogo || cause.logo}`).join(',');
}

/*
  Generates the demo's fundraisers for this year's causes, the same every time for the same causes. Besides a few hundred
  ordinary campaigns, published as the event starts or during it, it includes team events with supporting campaigns, teams without a team event, and campaigns made
  to check how the pages cope with long or unusual text, missing or broken images, goals and amounts at the extremes,
  and fundraisers that are always or never live. The last cause gets no campaigns of its own, to show a cause that only
  has its share of the money given to every cause.
*/
export function createRoster(causes: Cause[]): DemoRoster {
    const random = seededRandom(SEED);
    const logos = causes.map(cause => cause.borderedLogo || cause.logo).filter(Boolean);
    const dedicatedCauses = causes.length > 1 ? causes.slice(0, -1) : causes;
    const usernames = new Set<string>();
    const entries: Entry[] = [];

    const avatar = (): string => {
        const roll = random();
        return roll < 0.72 && logos.length > 0 ? pick(random, logos) : roll < 0.97 ? '' : BROKEN_IMAGE;
    };

    const causeId = (allCausesChance = ALL_CAUSES_CHANCE): string | null =>
        dedicatedCauses.length === 0 || chance(random, allCausesChance) ? null : pick(random, dedicatedCauses).id;

    const username = (): string => {
        let name = `${pick(random, words.USER_FIRST)}${pick(random, words.USER_SECOND)}`;
        if (chance(random, 0.3)) {
            name += integer(random, 1, 99);
        }
        while (usernames.has(name)) {
            name += integer(random, 0, 9);
        }
        usernames.add(name);
        return name;
    };

    const add = (spec: Spec): DemoFundraiser => {
        const id = uuid(random);
        const slug = generateSlug(spec.name) || id;
        const userName = spec.username || username();
        const userSlug = generateSlug(userName) || '';
        const user = spec.type === 'team_event' && spec.team
            ? { name: spec.team.name, slug: spec.team.slug, avatar: spec.team.avatar, url: spec.team.url }
            : { name: userName, slug: userSlug, avatar: spec.avatar ?? avatar(), url: `https://tiltify.com/@${userSlug}` };
        const multiplierRoll = random();

        const fundraiser: DemoFundraiser = {
            seed: Math.floor(random() * 4294967296),
            campaign: {
                id,
                slug,
                name: spec.name,
                description: truncateDescription(spec.description ?? description(random)),
                url: `${user.url}/${slug}`,
                goal: 0,
                donationMatchMultiplier: spec.multiplier ?? (multiplierRoll < 0.7 ? 1 : multiplierRoll < 0.92 ? 2 : 3),
                causeId: spec.causeId,
                type: spec.type,
                team: spec.team ?? null,
                teamEvent: null,
                user,
            },
            share: 0,
            peak: spec.peak ?? random(),
            liveChance: spec.liveChance ?? pick(random, [0.08, 0.08, 0.08, 0.2, 0.2, 0.45]),
            streamLength: between(random, 30, 150) * MINUTE_MS,
            streamOffset: between(random, 0, 150) * MINUTE_MS,
            publishedAt: spec.publishedAt ?? publishedAt(random),
            supporting: [],
            social: getSocial(random, null),
            matches: [],
            rewards: [],
            donorLeaderboard: true,
            topDonorShare: 0,
            averageDonation: 0,
            extraMembers: 0,
        };
        entries.push({ fundraiser, spec });
        return fundraiser;
    };

    // Teams, the first of which run the team events
    const teams = words.TEAM_NAMES.map((name, i) => {
        const slug = generateSlug(name) || '';
        return { name, slug, avatar: i === 0 && logos.length > 0 ? logos[0] : avatar(), url: `https://tiltify.com/+${slug}` };
    });

    const teamEvents = teams.slice(0, TEAM_EVENT_COUNT).map((team, i) => add(i === 0
        ? { name: `${team.name} ${words.TEAM_EVENT_TITLES[0]}`, type: 'team_event', team, causeId: null, multiplier: 2, liveChance: 0.95, peak: 0, publishedAt: 0, share: DEMO_TOTAL * MAIN_TEAM_EVENT_SHARE }
        : { name: `${team.name} ${pick(random, words.TEAM_EVENT_TITLES)}`, type: 'team_event', team, causeId: causeId(0.5), liveChance: 0.6, publishedAt: 0, weight: 40 }
    ));

    const campaigns = Array.from({ length: RANDOM_CAMPAIGN_COUNT }, () => add({
        name: campaignName(random),
        type: 'campaign',
        causeId: causeId(),
        weight: Math.min(250, Math.pow(1 - random(), -1 / 1.2)),
    }));

    // The first campaigns join the teams, supporting their team event if it has one
    let next = 0;
    const join = (team: NonNullable<Campaign['team']>, teamEvent: DemoFundraiser | null, count: number, weightBoost = 1) => {
        for (const member of campaigns.slice(next, next + count)) {
            member.campaign.team = team;
            if (teamEvent) {
                const { id, name, slug, url } = teamEvent.campaign;
                member.campaign.teamEvent = { id, name, slug, avatar: team.avatar, url };
                teamEvent.supporting.push(member);
            }
            const entry = entries.find(e => e.fundraiser === member);
            if (entry) {
                entry.spec.weight = (entry.spec.weight ?? 1) * weightBoost;
            }
        }
        next += count;
    };
    teamEvents.forEach((teamEvent, i) => join(teams[i], teamEvent, i === 0 ? 12 : integer(random, 3, 8), i === 0 ? 12 : 1));
    teams.slice(TEAM_EVENT_COUNT).forEach(team => join(team, null, integer(random, 2, 4)));

    // Campaigns that check how the pages cope with the extremes
    const longDescription = Array.from({ length: 16 }, (_, i) => words.DESCRIPTION_SENTENCES[i % words.DESCRIPTION_SENTENCES.length]).join(' ');
    const edgeCases: Spec[] = [
        { name: 'An Incredibly Long Campaign Name That Keeps On Going To Check How Every Page Copes With Text That Will Not Fit On One Line', username: 'TheLongestUsernameAnyoneHasEverPickedForTiltify', description: longDescription, share: 12000 },
        { name: 'Salt & Pepper\'s <b>"Totally Safe"</b> Stream', username: 'Salt & Pepper', share: 4500 },
        { name: '🎄 Cosy Christmas ❄️ — Ünïcödé 日本語ストリーム', username: 'ユキ', multiplier: 2, share: 25000 },
        { name: 'No Goal Stream', goal: 0, share: 800 },
        { name: 'Smashed It Stream', goal: 1000, share: 9000 },
        { name: 'Nothing Raised Yet', goal: 500, share: 0 },
        { name: 'Pennies For Charity', goal: 10, share: 3.5 },
        { name: 'Broken Avatar Stream', avatar: BROKEN_IMAGE, share: 1500 },
        { name: 'No Avatar Stream', avatar: '', share: 1200 },
        { name: 'Always Live 24/7 Stream', liveChance: 1, multiplier: 3, share: 60000 },
        { name: 'Never Live Stream', liveChance: 0, share: 2000 },
    ].map(spec => ({ ...spec, type: 'campaign' as const, causeId: causeId(), publishedAt: 0 }));
    edgeCases.forEach(add);

    // Fixed shares come first, and the rest of the money is split by weight
    const fixed = entries.reduce((sum, { spec }) => sum + (spec.share ?? 0), 0);
    const pool = DEMO_TOTAL * (1 - DIRECT_SHARE) - fixed;
    const totalWeight = entries.reduce((sum, { spec }) => sum + (spec.share === undefined ? spec.weight ?? 1 : 0), 0);
    for (const { fundraiser, spec } of entries) {
        fundraiser.share = spec.share ?? pool * (spec.weight ?? 1) / totalWeight;
    }

    // Details that depend on the final amount, from each fundraiser's own seed
    for (const { fundraiser, spec } of entries) {
        const own = seededRandom(fundraiser.seed);
        const final = fundraiser.share + fundraiser.supporting.reduce((sum, member) => sum + member.share, 0);

        fundraiser.campaign.goal = spec.goal ?? (chance(own, 0.1) ? 0 : Math.max(50, niceAmount(final * between(own, 0.1, 0.5))));
        fundraiser.social = getSocial(own, fundraiser.campaign.user.slug || 'streamer', fundraiser === teamEvents[0] ? 0 : 0.1);
        fundraiser.matches = Array.from({ length: fundraiser.campaign.donationMatchMultiplier - 1 }, () => ({
            id: uuid(own),
            matchedBy: pick(own, words.SPONSORS),
            pledged: Math.max(50, niceAmount(final * between(own, 0.05, 0.3))),
            untilEnd: chance(own, 0.5),
        }));
        fundraiser.rewards = chance(own, 0.45) ? [] : Array.from({ length: integer(own, 1, 5) }, () => ({
            id: uuid(own),
            name: pick(own, words.REWARD_NAMES),
            description: pick(own, words.REWARD_DESCRIPTIONS),
            image: chance(own, 0.5) && logos.length > 0 ? pick(own, logos) : null,
            amount: pick(own, REWARD_AMOUNTS),
            quantity: chance(own, 0.5) ? null : pick(own, REWARD_QUANTITIES),
            sellRate: between(own, 0.3, 3),
            untilEnd: chance(own, 0.15),
        }));
        fundraiser.donorLeaderboard = !chance(own, 0.1);
        fundraiser.topDonorShare = between(own, 0.02, 0.09);
        fundraiser.averageDonation = between(own, 18, 60);
        fundraiser.extraMembers = fundraiser.campaign.type === 'team_event' ? integer(own, 0, 5) : 0;
    }

    const fundraisers = entries.map(entry => entry.fundraiser);
    return {
        key: getRosterKey(causes),
        fundraisers,
        byId: new Map(fundraisers.map(fundraiser => [fundraiser.campaign.id.toLowerCase(), fundraiser])),
        direct: DEMO_TOTAL * DIRECT_SHARE,
    };
}

// Nothing is published before the event: 40% go up as it starts, and the rest during it, more of them early on
function publishedAt(random: () => number): number {
    return chance(random, PUBLISHED_AT_START_CHANCE) ? 0 : Math.pow(random(), 2) * 0.85;
}

function campaignName(random: () => number): string {
    return `${pick(random, words.CAMPAIGN_PREFIXES)} ${pick(random, words.CAMPAIGN_ACTIVITIES)} ${pick(random, words.CAMPAIGN_SUFFIXES)}`.trim();
}

// One to three sentences, or none
function description(random: () => number): string {
    if (chance(random, 0.1)) {
        return '';
    }
    return Array.from({ length: Math.floor(between(random, 1, 4)) }, () => pick(random, words.DESCRIPTION_SENTENCES)).join(' ');
}

// Social links for a handle, with a chance of having none at all. Without a handle, every link is empty.
function getSocial(random: () => number, handle: string | null, noneChance = 0.1): Social {
    const none = !handle || chance(random, noneChance);
    return Object.fromEntries(SOCIAL_CHANCES.map(([key, probability]) => {
        const has = !none && chance(random, probability);
        const value = key === 'website' ? `https://example.com/${handle}` : key === 'discord' ? `discord.gg/${handle}` : handle;
        return [key, has ? value : null];
    })) as unknown as Social;
}
