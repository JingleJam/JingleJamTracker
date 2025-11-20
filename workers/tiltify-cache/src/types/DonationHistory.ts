export interface DonationHistory {
    year: number;
    event: {
        start: string;
        end: string;
    };
    total: {
        dollars: number;
        pounds: number;
    };
    donations: number;
    collections?: number;
    campaigns?: number;
};
