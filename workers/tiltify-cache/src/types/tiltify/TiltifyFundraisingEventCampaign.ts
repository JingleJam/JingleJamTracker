export interface TiltifyFundraisingEventCampaign {
    description: string;
    goal: {
        value: string;
    };
    livestream: {
        channel: string;
        type: string;
    } | null;
    name: string;
    publishedAt: string;
    region: {
        id: string;
    } | null;
    slug: string;
    supportedTeamEvent: {
        name: string;
        publicId: string;
        slug: string;
    } | null;
    totalAmountRaised: {
        value: string;
    };
    user: {
        avatar: {
            src: string;
        };
        id: number;
        slug: string;
        social: {
            twitch: string | null;
        };
        username: string;
    };
};

export interface FundraisingEventCampaignsData {
    publishedCampaigns: {
        edges: Array<{
            node: TiltifyFundraisingEventCampaign
        }>;
        pagination: {
            hasNextPage: boolean;
            limit: number;
            offset: number;
            total: number;
        };
    }
}