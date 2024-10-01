export interface TiltifyUserCampaign {
    cause: {
        id: number;
        name: string;
        slug: string;
    };
    fundraisingEvent: {
        legacyFundraisingEventId: number;
        name: string;
        publicId: string;
        slug: string;
    };
    goal: {
        value: string;
    };
    legacyCampaignId: number;
    livestream: string | null;
    name: string;
    originalGoal: {
        value: string;
    };
    publicId: string;
    region: number | null;
    rewards: Array<{
        amount: {
            value: string;
        };
        quantity: number;
        remaining: number;
    }>;
    slug: string;
    status: string;
    totalAmountRaised: {
        value: string;
    };
    user: {
        id: number;
        slug: string;
        totalAmountRaised: {
            value: string;
        };
        username: string;
    };
};
