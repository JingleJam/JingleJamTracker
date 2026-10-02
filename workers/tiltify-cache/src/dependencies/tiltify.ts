import { TiltifyMultiSearchResponse, TiltifyMultiSearchResult } from "tiltify-cache/types/tiltify/TiltifyMultiSearchCampaign";
import { TiltifyTemplateFact, TiltifyTemplateFactResponse } from "tiltify-cache/types/tiltify/TiltifyTemplateFact";
import { TiltifyUser, TiltifyUserResponse } from "tiltify-cache/types/tiltify/TiltifyUser";
import { TiltifyLeaderboards, TiltifyLeaderboardsResponse } from "tiltify-cache/types/tiltify/TiltifyLeaderboards";
import { TiltifyDonations, TiltifyDonationsResponse } from "tiltify-cache/types/tiltify/TiltifyDonations";

/*
    Tiltify's GraphQL API only accepts the queries its own website sends ("Client query not allowed" otherwise),
    so each query below is copied as-is from a request made by a Tiltify page. Whitespace differences are accepted.
*/
const TILTIFY_MULTI_SEARCH_ENDPOINT = 'https://api.tiltify.com/search/multi-search';
const TILTIFY_API_ENDPOINT = "https://api.tiltify.com/";
const TILTIFY_API_OPTIONS: RequestInit = {
    method: "POST",
    headers: {
        "content-type": "application/json",
    },
};

/*
    Gets default template fact data by ID (a fundraising event, campaign or team event)

    Used for:
        - Jingle Jam Pound Amount
        - Collections Data
        - Social links, donation matches, rewards and team member count of a single campaign or team event
*/
export async function getFact(id: string): Promise<TiltifyTemplateFact | null> {
    const query = `query get_default_template_fact($id: ID!) {\n  fact(id: $id) {\n    id\n    currentSlug\n    updatedAt\n    trackers\n    logo {\n      src\n      alt\n      width\n      height\n      __typename\n    }\n    template {\n      id\n      theme\n      panels {\n        id\n        name\n        __typename\n      }\n      ...DefaultTemplateFactElements\n      __typename\n    }\n    supportedFacts {\n      id\n      name\n      link\n      usageType\n      currentSlug\n      __typename\n    }\n    ...DefaultTemplateFactAbout\n    ...DefaultTemplateFactAuctionHouses\n    ...DefaultTemplateFactCurrentEvents\n    ...DefaultTemplateFactFAQ\n    ...DefaultTemplateFactFeaturedMedia\n    ...DefaultTemplateFactFitnessData\n    ...DefaultTemplateFactFundraiserRewards\n    ...DefaultTemplateFactFundraisers\n    ...DefaultTemplateFactHeader\n    ...DefaultTemplateFactImpactPoints\n    ...DefaultTemplateFactLeaderboards\n    ...DefaultTemplateFactLiveDonations\n    ...DefaultTemplateFactMilestones\n    ...DefaultTemplateFactPolls\n    ...DefaultTemplateFactRewards\n    ...DefaultTemplateFactSchedules\n    ...DefaultTemplateFactSponsors\n    ...DefaultTemplateFactTeamStats\n    ...DefaultTemplateFactToolkit\n    ...DefaultTemplateFactUpdates\n    __typename\n  }\n}\n\nfragment DefaultTemplateFactElements on FactTemplate {\n  id\n  primaryFont\n  secondaryFont\n  panels {\n    id\n    name\n    config {\n      backgroundColor\n      customBackgroundColor\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactAbout on Fact {\n  id\n  name\n  description\n  contactEmail\n  avatar {\n    src\n    alt\n    height\n    width\n    __typename\n  }\n  video\n  image {\n    src\n    alt\n    height\n    width\n    __typename\n  }\n  usageType\n  supportedFacts {\n    id\n    name\n    description\n    link\n    avatar {\n      src\n      alt\n      height\n      width\n      __typename\n    }\n    usageType\n    __typename\n  }\n  template {\n    id\n    panels {\n      id\n      config {\n        findOutMore\n        findOutMoreLink\n        contact\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactAuctionHouses on Fact {\n  id\n  __typename\n}\n\nfragment DefaultTemplateFactCurrentEvents on Fact {\n  id\n  currency\n  link\n  template {\n    id\n    primaryColor\n    panels {\n      id\n      config {\n        show\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactFAQ on Fact {\n  id\n  template {\n    id\n    primaryColor\n    panels {\n      id\n      config {\n        show\n        faqUrl\n        faqHeading\n        faqDescription\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactFeaturedMedia on Fact {\n  id\n  scheduleCount\n  useScheduledMedia\n  mediaTypes {\n    id\n    image {\n      src\n      alt\n      height\n      width\n      __typename\n    }\n    provider\n    value\n    default\n    position\n    __typename\n  }\n  template {\n    id\n    panels {\n      id\n      config {\n        fullWidth\n        chat\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  paginatedSchedules(first: 10, activeAndUpcoming: true) {\n    edges {\n      cursor\n      node {\n        id\n        description\n        endsAt\n        name\n        startsAt\n        scheduledFact {\n          id\n          name\n          avatar {\n            src\n            alt\n            height\n            width\n            __typename\n          }\n          link\n          mediaTypes {\n            id\n            image {\n              src\n              alt\n              height\n              width\n              __typename\n            }\n            provider\n            value\n            default\n            position\n            __typename\n          }\n          __typename\n        }\n        ...DefaultTemplateFactFeaturedMediaCurrentScheduleItem\n        ...DefaultTemplateFactFeaturedMediaFutureScheduleItem\n        __typename\n      }\n      __typename\n    }\n    pageInfo {\n      endCursor\n      startCursor\n      hasNextPage\n      hasPreviousPage\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactFeaturedMediaCurrentScheduleItem on Schedule {\n  id\n  description\n  endsAt\n  name\n  startsAt\n  scheduledFact {\n    id\n    name\n    avatar {\n      src\n      alt\n      height\n      width\n      __typename\n    }\n    link\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactFeaturedMediaFutureScheduleItem on Schedule {\n  id\n  description\n  name\n  startsAt\n  scheduledFact {\n    id\n    avatar {\n      src\n      alt\n      height\n      width\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactFitnessData on Fact {\n  id\n  template {\n    id\n    primaryColor\n    panels {\n      id\n      config {\n        show\n        stats\n        individualTime\n        individualDistance\n        teamDistance\n        teamTime\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  ...DefaultTemplateFactFitnessDataStats\n  ...DefaultTemplateFactFitnessDataRecentActivities\n  ...DefaultTemplateFactFitnessDataFitnessChart\n  __typename\n}\n\nfragment DefaultTemplateFactFitnessDataStats on Fact {\n  id\n  fitnessMeasurementUnit\n  fitnessTotals {\n    averagePaceMinutesKilometer\n    averagePaceMinutesMile\n    totalDistanceKilometers\n    totalDistanceMiles\n    totalDurationSeconds\n    totalSteps\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactFitnessDataRecentActivities on Fact {\n  id\n  fitnessActivities(first: 5) {\n    edges {\n      node {\n        id\n        ...DefaultTemplateFactFitnessDataRecentFitnessActivity\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  ...DefaultTemplateFactFitnessDataRecentActivity\n  __typename\n}\n\nfragment DefaultTemplateFactFitnessDataRecentFitnessActivity on FitnessActivity {\n  distanceMiles\n  id\n  distanceKilometers\n  durationSeconds\n  steps\n  elevationGainFeet\n  elevationGainMeters\n  paceMinutesMile\n  paceMinutesKilometer\n  startDate\n  obfuscatedPolyline\n  fitnessActivityType {\n    id\n    type\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactFitnessDataRecentActivity on Fact {\n  id\n  fitnessMeasurementUnit\n  showPolyline\n  __typename\n}\n\nfragment DefaultTemplateFactFitnessDataFitnessChart on Fact {\n  id\n  fitnessMeasurementUnit\n  fitnessDailyActivities {\n    date\n    totalDistanceKilometers\n    totalDistanceMiles\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactFundraiserRewards on Fact {\n  id\n  fundraiserRewards {\n    id\n    title\n    description\n    label\n    promoted\n    amount {\n      value\n      currency\n      __typename\n    }\n    fairMarketValue {\n      value\n      currency\n      __typename\n    }\n    image {\n      src\n      alt\n      height\n      width\n      __typename\n    }\n    __typename\n  }\n  template {\n    id\n    primaryColor\n    panels {\n      id\n      config {\n        show\n        fundraiserRewardsHeading\n        fundraiserRewardsDescription\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactFundraisers on Fact {\n  id\n  link\n  template {\n    id\n    primaryColor\n    panels {\n      id\n      config {\n        show\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactHeader on Fact {\n  id\n  name\n  fundraisingForName\n  status\n  usageType\n  restricted\n  avatar {\n    src\n    alt\n    height\n    width\n    __typename\n  }\n  region {\n    id\n    name\n    image {\n      src\n      alt\n      height\n      width\n      __typename\n    }\n    __typename\n  }\n  hasMembership\n  supportable\n  featureSettings {\n    originalGoalEnabled\n    monthlyGivingEnabled\n    __typename\n  }\n  amountRaised {\n    value\n    currency\n    __typename\n  }\n  totalAmountRaised {\n    value\n    currency\n    __typename\n  }\n  goal {\n    value\n    currency\n    __typename\n  }\n  originalGoal {\n    value\n    currency\n    __typename\n  }\n  donationMatches {\n    id\n    active\n    startedAtAmount {\n      value\n      currency\n      __typename\n    }\n    matchedAmountTotalAmountRaised {\n      value\n      currency\n      __typename\n    }\n    __typename\n  }\n  milestones {\n    id\n    name\n    amount {\n      value\n      currency\n      __typename\n    }\n    __typename\n  }\n  monthlyGivingStats {\n    donorCount\n    totalAmountRaised {\n      value\n      currency\n      __typename\n    }\n    __typename\n  }\n  ownership {\n    id\n    name\n    slug\n    __typename\n  }\n  team {\n    id\n    name\n    slug\n    usageType\n    avatar {\n      src\n      alt\n      height\n      width\n      __typename\n    }\n    __typename\n  }\n  shareLinks {\n    supportLink\n    __typename\n  }\n  social {\n    discord\n    facebook\n    instagram\n    snapchat\n    tiktok\n    twitch\n    twitter\n    website\n    youtube\n    linkedin\n    __typename\n  }\n  supportedFacts {\n    id\n    name\n    usageType\n    link\n    ownership {\n      id\n      name\n      __typename\n    }\n    team {\n      id\n      name\n      slug\n      avatar {\n        src\n        alt\n        height\n        width\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  template {\n    id\n    primaryColor\n    secondaryFont\n    panels {\n      id\n      config {\n        alignment\n        heading\n        subHeading\n        donateButton\n        donateMonthlyButton\n        startFundraisingButton\n        amountRaised\n        fundraisingGoal\n        teamAmountRaised\n        teamFundraisingGoal\n        teamCard\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  ...DefaultTemplateFactHeaderDonationMatches\n  ...DefaultTemplateFactHeaderFitnessgoals\n  __typename\n}\n\nfragment DefaultTemplateFactHeaderDonationMatches on Fact {\n  id\n  donationMatches {\n    id\n    totalAmountRaised {\n      value\n      currency\n      __typename\n    }\n    pledgedAmount {\n      value\n      currency\n      __typename\n    }\n    endsAt\n    ...DefaultTemplateFactHeaderDonationMatchesDonationMatch\n    ...SharedComponentMatch\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactHeaderDonationMatchesDonationMatch on DonationMatch {\n  id\n  matchedBy\n  totalAmountRaised {\n    value\n    currency\n    __typename\n  }\n  pledgedAmount {\n    value\n    currency\n    __typename\n  }\n  startsAt\n  endsAt\n  __typename\n}\n\nfragment SharedComponentMatch on DonationMatch {\n  id\n  matchedBy\n  totalAmountRaised {\n    value\n    currency\n    __typename\n  }\n  pledgedAmount {\n    value\n    currency\n    __typename\n  }\n  startsAt\n  endsAt\n  active\n  __typename\n}\n\nfragment DefaultTemplateFactHeaderFitnessgoals on Fact {\n  id\n  fitnessMeasurementUnit\n  fitnessGoals {\n    id\n    currentValue {\n      unit\n      value\n      __typename\n    }\n    goal {\n      unit\n      value\n      __typename\n    }\n    type\n    __typename\n  }\n  template {\n    id\n    primaryColor\n    panels {\n      id\n      config {\n        distanceProgress\n        stepProgress\n        timeProgress\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactImpactPoints on Fact {\n  id\n  impactPoints {\n    id\n    name\n    amount {\n      value\n      currency\n      __typename\n    }\n    description\n    __typename\n  }\n  template {\n    id\n    primaryColor\n    panels {\n      id\n      config {\n        show\n        impactPointsHeader\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactLeaderboards on Fact {\n  id\n  currency\n  link\n  template {\n    id\n    primaryColor\n    panels {\n      id\n      config {\n        show\n        individual\n        team\n        donor\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactLiveDonations on Fact {\n  id\n  template {\n    id\n    secondaryFont\n    panels {\n      id\n      config {\n        show\n        backgroundColor\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactMilestones on Fact {\n  id\n  milestones {\n    id\n    name\n    amount {\n      value\n      currency\n      __typename\n    }\n    active\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactPolls on Fact {\n  id\n  polls {\n    id\n    active\n    updatedAt\n    ...DefaultTemplateFactPollsPoll\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactPollsPoll on Poll {\n  id\n  name\n  endsAt\n  goal {\n    value\n    currency\n    __typename\n  }\n  amountRaised(factId: $id) {\n    value\n    currency\n    __typename\n  }\n  totalAmountRaised {\n    value\n    currency\n    __typename\n  }\n  ownerUsageType\n  pollOptions {\n    id\n    name\n    amountRaised(factId: $id) {\n      value\n      currency\n      __typename\n    }\n    totalAmountRaised {\n      value\n      currency\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactRewards on Fact {\n  id\n  rewards {\n    id\n    updatedAt\n    active\n    promoted\n    amount {\n      value\n      currency\n      __typename\n    }\n    ...DefaultTemplateFactRewardsReward\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactRewardsReward on Reward {\n  id\n  name\n  description\n  image {\n    src\n    alt\n    height\n    width\n    __typename\n  }\n  amount {\n    value\n    currency\n    __typename\n  }\n  quantity\n  remaining\n  endsAt\n  startsAt\n  ownerUsageType\n  __typename\n}\n\nfragment DefaultTemplateFactSchedules on Fact {\n  id\n  scheduleCount\n  paginatedSchedules(first: 10, activeAndUpcoming: true) {\n    edges {\n      cursor\n      node {\n        id\n        ...DefaultTemplateFactSchedulesSchedule\n        __typename\n      }\n      __typename\n    }\n    pageInfo {\n      endCursor\n      startCursor\n      hasNextPage\n      hasPreviousPage\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactSchedulesSchedule on Schedule {\n  id\n  description\n  endsAt\n  name\n  startsAt\n  scheduledFact {\n    id\n    name\n    avatar {\n      src\n      alt\n      height\n      width\n      __typename\n    }\n    link\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactSponsors on Fact {\n  id\n  sponsors {\n    id\n    name\n    link\n    image {\n      src\n      alt\n      height\n      width\n      __typename\n    }\n    __typename\n  }\n  template {\n    id\n    primaryColor\n    panels {\n      id\n      config {\n        show\n        sponsorHeading\n        sponsorDescription\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactTeamStats on Fact {\n  id\n  publishedAt\n  teamMemberCount\n  supportingFactsCount(usageTypes: [CAMPAIGN])\n  template {\n    id\n    primaryColor\n    panels {\n      id\n      config {\n        show\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactToolkit on Fact {\n  id\n  template {\n    id\n    primaryColor\n    panels {\n      id\n      config {\n        show\n        toolkitUrl\n        toolkitHeading\n        toolkitDescription\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactUpdates on Fact {\n  id\n  factUpdates {\n    id\n    ...DefaultTemplateFactUpdatesFactUpdate\n    __typename\n  }\n  __typename\n}\n\nfragment DefaultTemplateFactUpdatesFactUpdate on FactUpdate {\n  id\n  description\n  insertedAt\n  title\n  image {\n    src\n    alt\n    height\n    width\n    __typename\n  }\n  __typename\n}`;

    const request: RequestInit = {
        body: JSON.stringify({
            "operationName": "get_default_template_fact",
            "variables": {
                "id": id
            },
            "query": query
        }),
        ...TILTIFY_API_OPTIONS
    };

    const response = await fetch(TILTIFY_API_ENDPOINT, request);
    const data = (await response.json()) as TiltifyTemplateFactResponse;
    return data?.data?.fact || null;
}

/*
    Gets the list of all campaigns for a given fundraiser

    Used for:
        - Listing Out Campaigns
        - Calculating Raised for each Cause

    The search returns at most 1000 results per filter, so callers split the campaigns into groups
    with extraFilter (e.g. by region) to keep each group under that limit.
*/
export async function getCampaigns(fundraiserPublicId: string, extraFilter: string, offset: number): Promise<TiltifyMultiSearchResult> {
    const request: RequestInit = {
        body: JSON.stringify({
            "queries": [
                {
                    "indexUid": "facts",
                    // Filter on status rather than public: team events stop being public once they are
                    // retired, while retired campaigns stay public. This keeps both, and drops deleted
                    // and unpublished fundraisers.
                    "filter": [
                        "fundraising_event_public_id = " + fundraiserPublicId + " AND status IN [published, retired]" + (extraFilter ? " AND " + extraFilter : "")
                    ],
                    "attributesToHighlight": [
                        "*"
                    ],
                    "highlightPreTag": "__ais-highlight__",
                    "highlightPostTag": "__/ais-highlight__",
                    "hitsPerPage": 100,
                    "page": offset
                }
            ]
        }),
        method: "POST",
        headers: {
            "content-type": "application/json",
            "Origin": "https://jinglejam.tiltify.com",
        },
    };

    const response = await fetch(TILTIFY_MULTI_SEARCH_ENDPOINT, request);
    const data = (await response.json()) as TiltifyMultiSearchResponse;
    
    return data?.results?.[0] as TiltifyMultiSearchResult || {
        indexUid: "facts",
        hits: [],
        query: "",
        processingTimeMs: 0,
        hitsPerPage: 100,
        page: offset,
        totalPages: 0,
        totalHits: 0,
        requestUid: ""
    };
}

/*
    Gets user data by slug

    Used for:
        - Fetching user profile information
        - Getting user's total amount raised
        - Getting user's team memberships
*/
export async function getUserBySlug(slug: string): Promise<TiltifyUser | null> {
    const query = `query get_user_by_slug($slug: String!) {\n  user(slug: $slug) {\n    id\n    username\n    slug\n    description\n    createdAt\n    totalAmountRaised {\n      currency\n      value\n      __typename\n    }\n    avatar {\n      alt\n      src\n      __typename\n    }\n    social {\n      twitter\n      discord\n      facebook\n      website\n      snapchat\n      instagram\n      youtube\n      tiktok\n      twitch\n      linkedin\n      __typename\n    }\n    teamMemberships {\n      publicId\n      roles {\n        publicId\n        name\n        description\n        __typename\n      }\n      team {\n        id\n        publicId\n        slug\n        name\n        description\n        avatar {\n          src\n          alt\n          width\n          height\n          __typename\n        }\n        totalAmountRaised {\n          value\n          currency\n          __typename\n        }\n        memberCount\n        __typename\n      }\n      __typename\n    }\n    publishedCampaigns(first: 4) {\n      edges {\n        node {\n          ...campaignProfileAttributes\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    publishedAuctionHouses(first: 10) {\n      edges {\n        node {\n          publicId\n          avatar {\n            src\n            __typename\n          }\n          name\n          slug\n          cause {\n            name\n            __typename\n          }\n          totalAmountRaised {\n            value\n            currency\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    retiredCampaigns(first: 6) {\n      edges {\n        cursor\n        node {\n          ...campaignProfileAttributes\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    profileBadges {\n      earned\n      id\n      key\n      description\n      name\n      rank\n      translationKey\n      shareText\n      image {\n        src\n        __typename\n      }\n      smallImage {\n        src\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  badgeGroups {\n    description\n    key\n    name\n    rank\n    translationKey\n    badges(userId: 3) {\n      earned\n      id\n      key\n      description\n      name\n      rank\n      translationKey\n      shareText\n      image {\n        src\n        __typename\n      }\n      smallImage {\n        src\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment campaignProfileAttributes on Campaign {\n  publicId\n  name\n  slug\n  live\n  goal {\n    value\n    currency\n    __typename\n  }\n  totalAmountRaised {\n    value\n    currency\n    __typename\n  }\n  avatar {\n    src\n    __typename\n  }\n  cardImage {\n    src\n    __typename\n  }\n  cause {\n    id\n    name\n    slug\n    avatar {\n      src\n      alt\n      __typename\n    }\n    __typename\n  }\n  livestream {\n    channel\n    type\n    __typename\n  }\n  user {\n    id\n    username\n    slug\n    avatar {\n      src\n      __typename\n    }\n    __typename\n  }\n  team {\n    id\n    name\n    slug\n    avatar {\n      src\n      __typename\n    }\n    __typename\n  }\n  publishedAt\n  __typename\n}`;

    const request: RequestInit = {
        body: JSON.stringify({
            "operationName": "get_user_by_slug",
            "variables": {
                "slug": slug
            },
            "query": query
        }),
        ...TILTIFY_API_OPTIONS
    };

    const response = await fetch(TILTIFY_API_ENDPOINT, request);
    const data = (await response.json()) as TiltifyUserResponse;
    return data?.data?.user || null;
}
/*
    Gets the donor, user and team leaderboards of a fact by ID

    Used for:
        - Top donors of a single campaign or team event
*/
export async function getLeaderboards(id: string, limit: number): Promise<TiltifyLeaderboards | null> {
    const query = `query get_default_template_fact_leaderboards($id: ID!, $limit: Int) {\n  fact(id: $id) {\n    id\n    donorLeaderboard(range: "default") {\n      id\n      ...DefaultTemplateFactLeaderboardsAmount\n      __typename\n    }\n    userLeaderboard(range: "default") {\n      id\n      ...DefaultTemplateFactLeaderboardsAmount\n      __typename\n    }\n    teamLeaderboard(range: "default") {\n      id\n      ...DefaultTemplateFactLeaderboardsAmount\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment DefaultTemplateFactLeaderboardsAmount on Leaderboard {\n  id\n  entries(first: $limit) {\n    edges {\n      node {\n        id\n        name\n        heat\n        url\n        amount {\n          value\n          currency\n          __typename\n        }\n        avatar {\n          src\n          alt\n          width\n          height\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n  __typename\n}`;

    const request: RequestInit = {
        body: JSON.stringify({
            "operationName": "get_default_template_fact_leaderboards",
            "variables": {
                "id": id,
                "limit": limit
            },
            "query": query
        }),
        ...TILTIFY_API_OPTIONS
    };

    const response = await fetch(TILTIFY_API_ENDPOINT, request);
    const data = (await response.json()) as TiltifyLeaderboardsResponse;
    return data?.data?.fact || null;
}

/*
    Gets the most recent donations to a fact by ID, newest first

    Used for:
        - Latest donations of a single campaign or team event
*/
export async function getDonations(id: string, limit: number): Promise<TiltifyDonations | null> {
    const query = `query get_fact_donations_by_id_asc($id: ID!, $limit: Int!, $cursor: String) {\n  fact(id: $id) {\n    id\n    donations(first: $limit, after: $cursor) {\n      pageInfo {\n        startCursor\n        endCursor\n        hasNextPage\n        hasPreviousPage\n        __typename\n      }\n      edges {\n        cursor\n        node {\n          id\n          ...DefaultTemplateFactLiveDonationsDonation\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment DefaultTemplateFactLiveDonationsDonation on Donation {\n  id\n  donorName\n  donorComment\n  dedication {\n    name\n    label\n    __typename\n  }\n  amount {\n    value\n    currency\n    __typename\n  }\n  matchCount\n  isMatch\n  incentives {\n    id\n    type\n    __typename\n  }\n  __typename\n}`;

    const request: RequestInit = {
        body: JSON.stringify({
            "operationName": "get_fact_donations_by_id_asc",
            "variables": {
                "id": id,
                "limit": limit
            },
            "query": query
        }),
        ...TILTIFY_API_OPTIONS
    };

    const response = await fetch(TILTIFY_API_ENDPOINT, request);
    const data = (await response.json()) as TiltifyDonationsResponse;
    return data?.data?.fact || null;
}
