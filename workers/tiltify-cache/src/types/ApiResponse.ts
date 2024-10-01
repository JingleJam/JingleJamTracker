import { Campaign } from "./Campaign";
import { Cause } from "./Cause";
import { DonationHistory } from "./DonationHistory";

export interface ApiResponse {
    date: Date;
    event: {
        year: number;
        start: Date;
        end: Date;
    };
    avgConversionRate: number;
    raised: {
        yogscast: number;
        fundraisers: number;
    };
    collections: {
        redeemed: number;
        total: number;
    };
    donations: {
        count: number;
    };
    history: DonationHistory[];
    causes: Cause[];
    campaigns: {
        count: number;
        list: Campaign[];
    };
}