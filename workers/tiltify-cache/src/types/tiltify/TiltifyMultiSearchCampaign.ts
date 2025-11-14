export interface TiltifyAvatar {
    width: number;
    height: number;
    alt: string;
    src: string;
}

export interface TiltifyFormattedAvatar {
    width: string;
    height: string;
    alt: string;
    src: string;
}

export interface TiltifyMultiSearchCampaign {
    id: string;
    clean_name: string;
    cause_name: string;
    username: string;
    cause_avatar: TiltifyAvatar;
    description: string;
    region_id: number;
    milestone_ratio: number;
    public: boolean;
    user_auction_house: string | null;
    plan_tier: number;
    short_description: string | null;
    currency: string;
    team_name: string | null;
    parent_clean_name: string;
    cause_public_id: string;
    parent_name: string;
    cause_slug: string;
    cause_fact_public_id: string;
    status: string;
    url: string;
    user_avatar: TiltifyAvatar;
    last_donation_at_utc: string | null;
    fundraising_event_public_id: string;
    campaign_fact_public_id: string | null;
    team_public_id: string | null;
    match_count: number;
    live: boolean;
    promoted: boolean;
    published: boolean;
    promoted_at_utc: number;
    is_campaign: boolean;
    retired_at_utc: number;
    goal: number;
    goal_ratio: number;
    name: string;
    sort_name: string;
    avatar: TiltifyAvatar | null;
    country: string;
    team_avatar: TiltifyAvatar | null;
    fact_avatar: TiltifyAvatar;
    type: string;
    live_at_utc: number;
    published_at_utc: number;
    auction_eligible: boolean;
    supportable: boolean;
    total_amount_raised: number;
    team_event_public_id: string | null;
    required_fee: boolean;
    required_registration: boolean;
    supporting_fundraising_event: boolean;
    _formatted: {
        id: string;
        clean_name: string;
        cause_name: string;
        username: string;
        cause_avatar: TiltifyFormattedAvatar;
        description: string;
        region_id: string;
        milestone_ratio: string;
        public: boolean;
        user_auction_house: string | null;
        plan_tier: string;
        short_description: string | null;
        currency: string;
        team_name: string | null;
        parent_clean_name: string;
        cause_public_id: string;
        parent_name: string;
        cause_slug: string;
        cause_fact_public_id: string;
        status: string;
        url: string;
        user_avatar: TiltifyFormattedAvatar;
        last_donation_at_utc: string | null;
        fundraising_event_public_id: string;
        campaign_fact_public_id: string | null;
        team_public_id: string | null;
        match_count: string;
        live: boolean;
        promoted: boolean;
        published: boolean;
        promoted_at_utc: string;
        is_campaign: boolean;
        retired_at_utc: string;
        goal: string;
        goal_ratio: string;
        name: string;
        sort_name: string;
        avatar: TiltifyFormattedAvatar | null;
        country: string;
        team_avatar: TiltifyFormattedAvatar | null;
        fact_avatar: TiltifyFormattedAvatar;
        type: string;
        live_at_utc: string;
        published_at_utc: string;
        auction_eligible: boolean;
        supportable: boolean;
        total_amount_raised: string;
        team_event_public_id: string | null;
        required_fee: boolean;
        required_registration: boolean;
        supporting_fundraising_event: boolean;
    };
}

export interface TiltifyMultiSearchResult {
    indexUid: string;
    hits: TiltifyMultiSearchCampaign[];
    query: string;
    processingTimeMs: number;
    hitsPerPage: number;
    page: number;
    totalPages: number;
    totalHits: number;
}

export interface TiltifyMultiSearchResponse {
    results: TiltifyMultiSearchResult[];
}
