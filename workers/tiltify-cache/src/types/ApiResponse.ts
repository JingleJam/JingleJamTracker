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
    dollarConversionRate: number;
    raised: number;
    collections: {
        redeemed: number;
        total: number;
    };
    donations: number;
    history: DonationHistory[];
    causes: Cause[];
    campaigns: {
        count: number;
        list: Campaign[];
    };
}