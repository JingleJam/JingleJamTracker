export interface YogscastDonationData {
    total: number;
    formatted_total: string;
    total_usd: number;
    formatted_total_usd: string;
    effective_exchange_rate: number;
    donations: number;
    donations_with_reward: number;
    donations_by_reward_count: Array<{
        quantity: number;
        count: number;
    }>;
};
