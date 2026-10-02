// Live data for a single campaign or team event, fetched from Tiltify when it is requested
export interface FactDetails {
    social: Social;
    donationMatches: DonationMatch[];
    rewards: Reward[];
    topDonors: TopDonor[];
    teamMemberCount: number | null;
}

export interface Social {
    discord: string | null;
    facebook: string | null;
    instagram: string | null;
    linkedin: string | null;
    snapchat: string | null;
    tiktok: string | null;
    twitch: string | null;
    twitter: string | null;
    website: string | null;
    youtube: string | null;
}

export interface DonationMatch {
    id: string;
    matchedBy: string;
    pledged: number;
    matched: number;
    startsAt: string | null;
    endsAt: string | null;
}

export interface Reward {
    id: string;
    name: string;
    description: string;
    image: string | null;
    amount: number;
    quantity: number | null;
    remaining: number | null;
    startsAt: string | null;
    endsAt: string | null;
}

export interface TopDonor {
    name: string;
    amount: number;
}
