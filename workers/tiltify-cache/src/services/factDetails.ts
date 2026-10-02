import { FACT_DETAILS_TTL_MS, LATEST_DONATION_LIMIT, TOP_DONOR_LIMIT } from "tiltify-cache/constants";
import { getDonations, getFact, getLeaderboards } from "tiltify-cache/dependencies/tiltify";
import { FactDetails, Social } from "tiltify-cache/types/FactDetails";
import { TiltifyTemplateFact } from "tiltify-cache/types/tiltify/TiltifyTemplateFact";
import { TiltifyLeaderboards } from "tiltify-cache/types/tiltify/TiltifyLeaderboards";
import { TiltifyDonations } from "tiltify-cache/types/tiltify/TiltifyDonations";
import { roundAmount } from "tiltify-cache/utils";

// Rewards owned by the fundraising event (the Jingle Jam Games Collection) are on every fundraiser, so they are left out
const EVENT_REWARD_OWNER = 'fundraising_event_activation';

const SOCIAL_KEYS: (keyof Social)[] = ['discord', 'facebook', 'instagram', 'linkedin', 'snapchat', 'tiktok', 'twitch', 'twitter', 'website', 'youtube'];

interface CacheEntry {
    fetchedAt: number;
    details: FactDetails | null;
    refreshing: Promise<void> | null;
}

/**
 * Fact Details Service
 *
 * Fetches the live Tiltify data for a single campaign or team event (social links, donation matches, rewards,
 * top donors, latest donations and team member count) and keeps it in memory for FACT_DETAILS_TTL_MS, so repeated requests for
 * the same fundraiser share one set of Tiltify calls.
 *
 * Callers only pass ids from this year's campaign list, so the cache holds at most one entry per fundraiser.
 */
export class FactDetailsService {
    private entries = new Map<string, CacheEntry>();

    async get(id: string): Promise<FactDetails> {
        let entry = this.entries.get(id);
        if (!entry) {
            entry = { fetchedAt: 0, details: null, refreshing: null };
            this.entries.set(id, entry);
        }

        if (Date.now() - entry.fetchedAt >= FACT_DETAILS_TTL_MS) {
            const current = entry;
            current.refreshing ??= this.refresh(id, current).finally(() => {
                current.refreshing = null;
            });
            await current.refreshing;
        }

        return entry.details || getEmptyDetails();
    }

    // Fetch the latest data, keeping the previous data for any part that fails to load
    private async refresh(id: string, entry: CacheEntry): Promise<void> {
        const [factResult, leaderboardsResult, donationsResult] = await Promise.allSettled([
            getFact(id),
            getLeaderboards(id, TOP_DONOR_LIMIT),
            getDonations(id, LATEST_DONATION_LIMIT)
        ]);

        const fact = factResult.status === 'fulfilled' ? factResult.value : null;
        const leaderboards = leaderboardsResult.status === 'fulfilled' ? leaderboardsResult.value : null;
        const donations = donationsResult.status === 'fulfilled' ? donationsResult.value : null;
        if (!fact || !leaderboards || !donations) {
            console.error(`Failed to fetch live Tiltify data for ${id}`, factResult, leaderboardsResult, donationsResult);
        }

        const previous = entry.details || getEmptyDetails();
        entry.details = {
            ...(fact ? getFactData(fact) : previous),
            topDonors: leaderboards ? getTopDonors(leaderboards) : previous.topDonors,
            latestDonations: donations ? getLatestDonations(donations) : previous.latestDonations,
        };

        // Failed fetches also wait for the TTL, so a Tiltify outage isn't retried on every request
        entry.fetchedAt = Date.now();
    }
}

function getFactData(fact: TiltifyTemplateFact): Omit<FactDetails, 'topDonors' | 'latestDonations'> {
    return {
        social: Object.fromEntries(SOCIAL_KEYS.map(key => [key, fact.social?.[key] || null])) as unknown as Social,
        donationMatches: (fact.donationMatches || [])
            .filter(match => match.active)
            .map(match => ({
                id: match.id,
                matchedBy: match.matchedBy,
                pledged: toAmount(match.pledgedAmount?.value),
                matched: toAmount(match.totalAmountRaised?.value),
                startsAt: match.startsAt || null,
                endsAt: match.endsAt || null,
            })),
        rewards: (fact.rewards || [])
            .filter(reward => reward.active && reward.ownerUsageType !== EVENT_REWARD_OWNER)
            .map(reward => ({
                id: reward.id,
                name: reward.name,
                description: reward.description || '',
                image: reward.image?.src || null,
                amount: toAmount(reward.amount?.value),
                quantity: reward.quantity ?? null,
                remaining: reward.remaining ?? null,
                startsAt: reward.startsAt || null,
                endsAt: reward.endsAt || null,
            })),
        teamMemberCount: fact.teamMemberCount ?? null,
    };
}

// Tiltify returns no donor leaderboard (null) when the fundraiser has it turned off in its page settings
function getTopDonors(leaderboards: TiltifyLeaderboards): FactDetails['topDonors'] {
    if (!leaderboards.donorLeaderboard) {
        return null;
    }
    return (leaderboards.donorLeaderboard.entries?.edges || []).map(edge => ({
        name: edge.node.name,
        amount: toAmount(edge.node.amount?.value),
    }));
}

// Newest first, as Tiltify returns them
function getLatestDonations(donations: TiltifyDonations): FactDetails['latestDonations'] {
    return (donations.donations?.edges || []).map(edge => ({
        name: edge.node.donorName,
        amount: toAmount(edge.node.amount?.value),
        comment: edge.node.donorComment || null,
    }));
}

function getEmptyDetails(): FactDetails {
    return {
        social: Object.fromEntries(SOCIAL_KEYS.map(key => [key, null])) as unknown as Social,
        donationMatches: [],
        rewards: [],
        topDonors: [],
        latestDonations: [],
        teamMemberCount: null,
    };
}

function toAmount(value: string | undefined): number {
    return roundAmount(parseFloat(value || '0') || 0);
}
