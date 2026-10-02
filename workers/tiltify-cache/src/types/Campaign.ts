export interface Campaign {
    causeId: string | null;
    name: string;
    description: string;
    id: string;
    slug: string;
    url: string;
    startTime: string | null;
    raised: number;
    goal: number;
    live: boolean;
    donationMatchMultiplier: number;
    type: string;
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