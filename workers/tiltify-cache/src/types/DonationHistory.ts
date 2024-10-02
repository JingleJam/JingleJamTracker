export interface DonationHistory {
    year: number;
    total: {
        dollars: number;
        pounds: number;
    };
    donations: number;
};
