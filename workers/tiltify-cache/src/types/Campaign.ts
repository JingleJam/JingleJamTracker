export interface Campaign {
    causeId: string | null;
    name: string;
    description: string;
    id: string;
    slug: string;
    url: string;
    startTime: string | null;
    raised: number;
    raisedBreakdown?: {         // Team events only
        teamEvent: number;      // Donations made to the team event itself
        campaigns: number;      // Donations made to its supporting campaigns
    };
    goal: number;
    live: boolean;
    donationMatchMultiplier: number;
    type: 'campaign' | 'team_event';   // Auction houses and every other kind of fundraiser count as campaigns
    team: {
        name: string;
        slug: string;
        avatar: string;
        url: string;
    } | null;
    teamEvent: {
        id: string;
        name: string;
        slug: string;
        avatar: string;
        url: string;
    } | null;
    user: {
        name: string;
        slug: string;
        avatar: string;
        url: string;
    };
};