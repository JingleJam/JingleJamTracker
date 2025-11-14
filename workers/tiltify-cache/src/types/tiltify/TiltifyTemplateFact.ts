export interface TiltifyTemplateFactResponse {
    data: {
        fact: TiltifyTemplateFact;
    };
}

export interface TiltifyTemplateFact {
    __typename: "Fact";
    fitnessDailyActivities: FitnessDailyActivity[];
    contactEmail: string;
    region: string | null;
    impactPoints: unknown[];
    scheduleCount: number;
    fitnessActivities: NewFitnessActivityConnection;
    totalAmountRaised: Currency;
    teamMemberCount: number;
    avatar: Image;
    featureSettings: FactFeatureSettings;
    sponsors: unknown[];
    monthlyGivingStats: MonthlyGivingStats;
    milestones: unknown[];
    originalGoal: Currency;
    template: FactTemplate;
    useScheduledMedia: boolean;
    fundraiserRewards: unknown[];
    video: unknown | null;
    fitnessTotals: FitnessTotals;
    currentSlug: string;
    image: Image | null;
    link: string;
    status: string;
    publishedAt: string;
    description: string;
    name: string;
    id: string;
    factUpdates: unknown[];
    shareLinks: ShareLinks;
    fundraisingForName: string | null;
    rewards: Reward[];
    fitnessGoals: unknown[];
    updatedAt: string;
    supportingFactsCount: number;
    currency: string;
    trackers: string[];
    fitnessMeasurementUnit: string;
    goal: Currency;
    challenges: unknown[];
    showPolyline: boolean | null;
    bonfire: unknown | null;
    supportedFacts: SupportedFact[];
    restricted: boolean;
    mediaTypes: MediaType[];
    polls: unknown[];
    ownership: FactOwner;
    usageType: string;
    paginatedSchedules: NewScheduleConnection;
    supportable: boolean;
    donationMatches: unknown[];
    social: Social;
}

export interface FitnessDailyActivity {
    __typename: "FitnessDailyActivity";
    date: string;
    totalDistanceKilometers: string;
    totalDistanceMiles: string;
}

export interface NewFitnessActivityConnection {
    __typename: "NewFitnessActivityConnection";
    edges: unknown[];
}

export interface Currency {
    __typename: "Currency";
    currency: string;
    value: string;
}

export interface Image {
    __typename: "Image";
    alt: string;
    height: number;
    src: string;
    width: number;
}

export interface FactFeatureSettings {
    __typename: "FactFeatureSettings";
    monthlyGivingEnabled: boolean;
}

export interface MonthlyGivingStats {
    __typename: "MonthlyGivingStats";
    donorCount: number;
    totalAmountRaised: Currency;
}

export interface FactTemplate {
    __typename: "FactTemplate";
    id: string;
    panels: FactTemplatePanel[];
    primaryColor: string;
    primaryFont: string;
    secondaryFont: string;
    theme: string;
}

export interface FactTemplatePanel {
    __typename: "FactTemplatePanel";
    config: FactTemplatePanelConfig;
    id: string;
    name: string;
}

export interface FactTemplatePanelConfig {
    __typename: "FactTemplatePanelConfig";
    stats: boolean | null;
    timeProgress: boolean | null;
    distanceProgress: boolean | null;
    backgroundColor: string | null;
    amountRaised: boolean | null;
    findOutMore: boolean | null;
    contact: boolean | null;
    individual: boolean | null;
    toolkitHeading: string | null;
    faqHeading: string | null;
    teamTime: boolean | null;
    subHeading: string | null;
    toolkitUrl: string | null;
    faqDescription: string | null;
    chat: boolean | null;
    fundraisingGoal: boolean | null;
    findOutMoreLink: string | null;
    donateButton: boolean | null;
    donateMonthlyButton: boolean | null;
    show: boolean | null;
    sponsorDescription: string | null;
    individualDistance: boolean | null;
    fullWidth: boolean | null;
    faqUrl: string | null;
    customBackgroundColor: boolean | null;
    individualTime: boolean | null;
    team: boolean | null;
    toolkitDescription: string | null;
    heading: string | null;
    donor: boolean | null;
    impactPointsHeader: string | null;
    fundraiserRewardsDescription: string | null;
    sponsorHeading: string | null;
    alignment: string | null;
    startFundraisingButton: boolean | null;
    fundraiserRewardsHeading: string | null;
    teamDistance: boolean | null;
    stepProgress: boolean | null;
}

export interface FitnessTotals {
    __typename: "FitnessTotals";
    averagePaceMinutesKilometer: string;
    averagePaceMinutesMile: string;
    totalDistanceKilometers: string;
    totalDistanceMiles: string;
    totalDurationSeconds: number;
    totalSteps: number;
}

export interface ShareLinks {
    __typename: "ShareLinks";
    supportLink: string | null;
}

export interface SupportedFact {
    __typename: "Fact";
    avatar: Image;
    currentSlug: string;
    description: string;
    id: string;
    link: string;
    name: string;
    ownership: FactOwner | null;
    usageType: string;
}

export interface MediaType {
    __typename: "MediaType";
    default: boolean;
    id: string;
    image: unknown | null;
    position: number;
    provider: string;
    value: string | null;
}

export interface FactOwner {
    __typename: "FactOwner";
    id: string;
    name: string;
    slug: string;
}

export interface NewScheduleConnection {
    __typename: "NewScheduleConnection";
    edges: unknown[];
    pageInfo: PageInfo;
}

export interface PageInfo {
    __typename: "PageInfo";
    endCursor: string | null;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
}

export interface Social {
    __typename: "Social";
    discord: string | null;
    facebook: string | null;
    instagram: string | null;
    linkedin: string | null;
    snapchat: string | null;
    tiktok: string | null;
    twitch: string | null;
    twitter: string | null;
    website: string | null;
    youtube: string | null;
}

export interface Reward {
    __typename: "Reward";
    active: boolean;
    amount: Currency;
    description: string;
    endsAt: string;
    id: string;
    image: Image;
    name: string;
    ownerUsageType: string;
    promoted: boolean;
    quantity: number;
    remaining: number;
    startsAt: string;
    updatedAt: string;
}

