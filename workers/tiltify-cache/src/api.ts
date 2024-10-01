import { roundAmount, sortByKey } from "./utils";
import { getCampaign, getEvent, getCampaigns, getYogscastAPI } from "./tiltify";
import { ApiResponse } from "./types/ApiResponse";
import { Env } from "./env";
import { Cause } from "./types/Cause";
import { DonationHistory } from "./types/DonationHistory";
import { TiltifyUserCampaign } from "./types/tiltify/TiltifyUserCampaign";
import { TiltifyFundraisingEvent } from "./types/tiltify/TiltifyFundraisingEvent";
import { YogscastDonationData } from "./types/yogscast/YogscastDonationData";
import { Campaign } from "./types/Campaign";
import { TiltifyFundraisingEventCampaign } from "./types/tiltify/TiltifyFundraisingEventCampaign";

const maxSim = 6; // Maximum number of simultaneous fetches
const maxNumOfCampaigns = 100;
const maxDescriptionLength = 1024;
const maxCampaigns = (20 * 900) - 2; // Maximum number of campaigns that can be fetched
const allCharitiesRegionId = 566;

// Old Team Data
// End of 2020 yogscast dollar amount = 2827226.00
// End of 2021 yogscast dollar amount = 6571211.42

// New User - @yogscast
// Pre-2022 Jingle Jam dollar amount = 36023.96
// End of 2022 yogscast dollar amount = 3368996.43
// Pre-2023 Jingle Jam dollar amount = 3371741.16
// End of 2023 yogscast dollar amount = 5747814.82
async function getSummaryData(env: Env): Promise<ApiResponse> {
  let apiResponse = getDefaultResponse(env);
  let campaignsComputed: Campaign[] = [];

  try {
    // INITIAL KV LOOKUPS
    const causes: Cause[] = JSON.parse(await env.JINGLE_JAM_DATA.get('causes') || "") || [];
    const summary: DonationHistory[] = JSON.parse(await env.JINGLE_JAM_DATA.get('summary') || "") || [];
    apiResponse = getDefaultResponse(env, causes, summary, env.CONVERSION_RATE);

    // INITIAL TILTIFY LOOKUPS
    const requests = [
      getCampaign(env.YOGSCAST_USERNAME_SLUG, env.YOGSCAST_CAMPAIGN_SLUG), // Gets Yogscast Campaign Data
      getEvent(env.CAUSE_SLUG, env.FUNDRAISER_SLUG), // Gets Yearly Event Level Data
      getYogscastAPI()
    ];

    const results = await Promise.all(requests);

    const yogscastCampaign: TiltifyUserCampaign | null = results[0] as TiltifyUserCampaign | null;
    const eventData: TiltifyFundraisingEvent | null = results[1] as TiltifyFundraisingEvent | null;
    const yogscastAPI: YogscastDonationData | null = results[2] as YogscastDonationData | null;

    // SUMMARY DATA
    const totalPounds = parseFloat(eventData?.totalAmountRaised.value || "0");
    const yogscastPounds = parseFloat(yogscastCampaign?.totalAmountRaised.value || "0");
    const yogscastDollars = roundAmount(parseFloat(yogscastCampaign?.user.totalAmountRaised.value || "0") - env.DOLLAR_OFFSET);
    const fundraiserPounds = roundAmount(totalPounds - yogscastPounds);

    apiResponse.raised.yogscast = yogscastPounds;
    apiResponse.raised.fundraisers = fundraiserPounds;

    apiResponse.avgConversionRate = env.CONVERSION_RATE;
    const division = yogscastDollars / yogscastPounds;
    if (!isNaN(division) && isFinite(division)) {
      apiResponse.avgConversionRate = roundAmount(division, 10);
    }

    // Gets collections counts
    try {
      const rewards = (eventData?.rewards?.length || 0) > 0 ? eventData?.rewards : yogscastCampaign?.rewards;
      if (rewards && rewards.length > 0) {
        apiResponse.collections.total = rewards[0].quantity;
        apiResponse.collections.redeemed = apiResponse.collections.total - rewards[0].remaining;
      }
    } catch {
      apiResponse.collections.total = env.COLLECTIONS_AVAILABLE;
      apiResponse.collections.redeemed = 0;
    }

    // Donation counts from Yogscast API
    apiResponse.donations.count = yogscastAPI?.donations || apiResponse.collections.redeemed || 0;

    // CAMPAIGN DATA
    let campaigns: { node: TiltifyFundraisingEventCampaign }[] = [];
    let offset = 0;
    let end = false;

    if (env.FUNDRAISER_PUBLIC_ID) {
      while (offset <= maxCampaigns && !end) {
        const requests = Array.from({ length: maxSim }, () => getCampaigns(env.FUNDRAISER_PUBLIC_ID, offset));
        offset += 20 * maxSim;

        const regionResponses = await Promise.all(requests);

        for (const response of regionResponses) {
          const campaignsData = response.publishedCampaigns;
          campaigns = campaigns.concat(campaignsData.edges);

          if (!campaignsData.pagination.hasNextPage) {
            end = true;
            break;
          }
        }
      }

      let campaignAmountPounds = 0;
      for (const campaign of campaigns) {
        const campaignRegionId = campaign.node.region?.id || 0;
        const isYogscastCampaign = campaign.node.user?.slug === env.YOGSCAST_USERNAME_SLUG;
        const isAllCharitiesCampaign = !campaignRegionId || campaignRegionId === allCharitiesRegionId;

        let amount = parseFloat(campaign.node.totalAmountRaised?.value || '0');
        campaignAmountPounds += amount;

        if (isAllCharitiesCampaign) {
          amount /= apiResponse.causes.length;
        }

        amount = roundAmount(amount);

        for (const cause of apiResponse.causes) {
          if (cause.id === campaignRegionId || isAllCharitiesCampaign) {
            if (isYogscastCampaign) {
              cause.raised.yogscast += amount;
            } else {
              cause.raised.fundraisers += amount;
            }
          }
        }
      }

      const amountDifference = totalPounds - campaignAmountPounds;
      if (amountDifference > 0) {
        apiResponse.raised.yogscast += amountDifference;
        apiResponse.raised.fundraisers -= amountDifference;

        apiResponse.raised.yogscast = roundAmount(apiResponse.raised.yogscast);
        apiResponse.raised.fundraisers = roundAmount(apiResponse.raised.fundraisers);

        const causeAmount = amountDifference / apiResponse.causes.length;
        for (const cause of apiResponse.causes) {
          cause.raised.yogscast += causeAmount;
        }
      }

      for (const cause of apiResponse.causes) {
        cause.raised.fundraisers = roundAmount(cause.raised.fundraisers);
        cause.raised.yogscast = roundAmount(cause.raised.yogscast);
      }
    }

    for (const campaign of campaigns) {
      const description = campaign.node.description?.length > maxDescriptionLength
        ? `${campaign.node.description.slice(0, maxDescriptionLength)}...`
        : campaign.node.description;
      campaignsComputed.push({
        causeId: campaign.node.region?.id || null,
        name: campaign.node.name,
        description: description,
        slug: campaign.node.slug,
        url: `https://tiltify.com/@${campaign.node.user?.slug}/${campaign.node.slug}`,
        startTime: campaign.node.publishedAt,
        raised: roundAmount(parseFloat(campaign.node.totalAmountRaised?.value) || 0),
        goal: roundAmount(parseFloat(campaign.node.goal?.value) || 0),
        livestream: {
          channel: campaign.node.livestream?.channel || campaign.node.user?.social.twitch,
          type: campaign.node.livestream?.type || 'twitch',
        },
        user: {
          id: campaign.node.user?.id,
          name: campaign.node.user?.username,
          slug: campaign.node.user?.slug,
          avatar: campaign.node.user?.avatar.src,
          url: `https://tiltify.com/@${campaign.node.user?.slug}`,
        },
      });
    }

    apiResponse.campaigns.count = campaignsComputed.length;
    apiResponse.campaigns.list = sortByKey(campaignsComputed, 'raised').slice(0, maxNumOfCampaigns);

  } catch (e) {
    console.error(e);
  }

  return apiResponse;
}

function getDefaultResponse(env: Env, causes: Cause[] = [], donationHistory: DonationHistory[] = [], defaultConversionRate = 1, date = new Date()): ApiResponse {
  const causeObjects: Cause[] = causes?.map(cause => ({
    id: cause.id,
    name: cause.name,
    logo: cause.logo,
    description: cause.description,
    url: cause.url,
    donateUrl: cause.donateUrl,
    raised: { yogscast: 0, fundraisers: 0 },
  }));

  return {
    date: date,
    event: {
      year: env.YEAR,
      start: new Date(Date.UTC(env.YEAR, 11, 1, 17, 0, 0)),
      end: new Date(Date.UTC(env.YEAR, 11, 15, 0, 0, 0)),
    },
    avgConversionRate: defaultConversionRate,
    raised: {
      yogscast: 0,
      fundraisers: 0,
    },
    collections: {
      redeemed: 0,
      total: env.COLLECTIONS_AVAILABLE,
    },
    donations: {
      count: 0,
    },
    history: donationHistory || [],
    causes: causeObjects,
    campaigns: {
      count: 0,
      list: [],
    },
  };
}

const debugStartDate = new Date(2023, 9, 17, 20, 20, 10);
const debugEndDate = new Date(2023, 10, 13, 22, 10, 0);

async function getDebugData(env: Env): Promise<ApiResponse> {
  const causes: Cause[] = JSON.parse(await env.JINGLE_JAM_DATA.get('causes') || "") || [];
  const defaultConversionRate = env.CONVERSION_RATE;
  const summary: DonationHistory[] = JSON.parse(await env.JINGLE_JAM_DATA.get('summary') || "") || [];

  const defaultResponse = getDefaultResponse(env, causes, summary, defaultConversionRate);

  defaultResponse.event.start = debugStartDate;
  defaultResponse.event.end = debugEndDate;

  const amount = 1 * Math.max(((new Date().getTime() - debugStartDate.getTime()) / 3.5913 % 5000000), 0);

  defaultResponse.raised.yogscast = amount * 0.8;
  defaultResponse.raised.fundraisers = amount * 0.2;

  defaultResponse.collections.redeemed = parseInt((amount / 40.84).toFixed(0));
  defaultResponse.donations.count = defaultResponse.collections.redeemed + 945;

  for (const cause of defaultResponse.causes) {
    cause.raised.yogscast = (amount / defaultResponse.causes.length) * 0.8;
    cause.raised.fundraisers = (amount / defaultResponse.causes.length) * 0.2;
  }

  return defaultResponse;
}

export async function getLatestData(env: Env): Promise<ApiResponse> {
  env.DONATION_DIFFERENCE = parseInt(env.DONATION_DIFFERENCE.toString());
  env.DOLLAR_OFFSET = parseFloat(env.DOLLAR_OFFSET.toString());
  env.COLLECTIONS_AVAILABLE = parseInt(env.COLLECTIONS_AVAILABLE.toString());
  env.YEAR = parseInt(env.YEAR.toString());
  env.CONVERSION_RATE = parseFloat(env.CONVERSION_RATE.toString());

  if (env.ENABLE_DEBUG) {
    return await getDebugData(env);
  }

  return await getSummaryData(env);
}
