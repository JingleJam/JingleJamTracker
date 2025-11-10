export interface Campaign {
    causeId: string | null;
    name: string;
    description: string;
    slug: string;
    url: string;
    startTime: string;
    raised: number;
    goal: number;
    livestream: {
        channel: string | null;
        type: string | null;
    };
    user: {
        id: number;
        name: string;
        slug: string;
        avatar: string;
        url: string;
    };
};