export interface TiltifyFundraisingEvent {
    amountRaised: {
        currency: string;
        value: string; // Stored as a string in the JSON
    };
    rewards: Array<{
        quantity: number;
        remaining: number;
    }>;
    totalAmountRaised: {
        value: string; // Stored as a string in the JSON
    };
};
