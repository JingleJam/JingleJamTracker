import { roundAmount, sortByKey } from "tiltify-cache/utils";
import { getCampaign, getEvent, getCampaigns } from "tiltify-cache/dependencies/tiltify";
import { get as getYogscastAPI } from "tiltify-cache/dependencies/yogscast";
import { ApiResponse } from "tiltify-cache/types/ApiResponse";
import { Env } from "tiltify-cache/types/env";
import { Cause } from "tiltify-cache/types/Cause";
import { DonationHistory } from "tiltify-cache/types/DonationHistory";
import { TiltifyUserCampaign } from "tiltify-cache/types/tiltify/TiltifyUserCampaign";
import { TiltifyFundraisingEvent } from "tiltify-cache/types/tiltify/TiltifyFundraisingEvent";
import { YogscastDonationData } from "tiltify-cache/types/yogscast/YogscastDonationData";
import { Campaign } from "tiltify-cache/types/Campaign";
import { TiltifyFundraisingEventCampaign } from "tiltify-cache/types/tiltify/TiltifyFundraisingEventCampaign";

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
  let campaignsComputed: Campaign[] = [];
  
  let causes: Cause[] = JSON.parse(await env.JINGLE_JAM_DATA.get('causes') || "") || [];

  let apiResponse = await getDefaultResponse(env, new Date(), causes);

  try {
    // Perform all Tiltify and Yogscast lookups in parallel
    const results = await Promise.all([
      getCampaign(env.YOGSCAST_USERNAME_SLUG, env.YOGSCAST_CAMPAIGN_SLUG),  // Gets Yogscast Campaign Data
      getEvent(env.CAUSE_SLUG, env.FUNDRAISER_SLUG),                        // Gets Yearly Event Level Data
      getYogscastAPI()                                                      // Gets Yogscast API Data
    ]);

    const yogscastCampaign: TiltifyUserCampaign | null = results[0] as TiltifyUserCampaign | null;
    const eventData: TiltifyFundraisingEvent | null = results[1] as TiltifyFundraisingEvent | null;
    const yogscastAPI: YogscastDonationData | null = results[2] as YogscastDonationData | null;

    /*
      Summary Data:
        - Yogscast Raised
        - Fundraisers Raised
        - Average Conversion Rate
        - Collections Redeemed
        - Collections Total
        - Donation Count
    */

    // Get the total amount raised from the whole event (Yogscast & Fundraisers)
    const totalPounds = parseFloat(eventData?.totalAmountRaised.value || "0");

    apiResponse.raised.yogscast = parseFloat(yogscastCampaign?.totalAmountRaised.value || "0"); // Get amount raised directly from the Yogscast Tiltify campaign
    apiResponse.raised.fundraisers = roundAmount(totalPounds - apiResponse.raised.yogscast); // Subtract Yogscast amount from total amount raised from the whole event

    // Calculate the average conversion rate over the period of the event
    const yogscastDollars = roundAmount(parseFloat(yogscastCampaign?.user.totalAmountRaised.value || "0") - env.DOLLAR_OFFSET);
    const division = yogscastDollars / apiResponse.raised.yogscast;

    if (!isNaN(division) && isFinite(division)) {
      apiResponse.avgConversionRate = roundAmount(division, 10);
    }
    else {
      apiResponse.avgConversionRate = env.CONVERSION_RATE;
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

    // Get donation counts from Yogscast API
    apiResponse.donations.count = yogscastAPI?.donations || 0;
    //apiResponse.donations.count += env.DONATION_DIFFERENCE;

    /*
      Campaigns:
        - Campaign List
        - Raised for each Cause
    */

    // Get the list of campaigns
    let campaigns: { node: TiltifyFundraisingEventCampaign }[] = [];
    let offset = 0;
    let end = false;

    // Get all campaigns from the fundraiser
    if (env.FUNDRAISER_PUBLIC_ID) {
      // Fetch all campaigns in parallel (chunks of 6 requests with 20 campaigns each)
      while (offset <= maxCampaigns && !end) {
        const requests = Array.from({ length: maxSim }, (_, i) => getCampaigns(env.FUNDRAISER_PUBLIC_ID, offset + (i * 20)));
        const regionResponses = await Promise.all(requests);
        offset += 20 * maxSim;

        for (const response of regionResponses) {
          const campaignsData = response.publishedCampaigns;
          campaigns = campaigns.concat(campaignsData.edges);

          if (!campaignsData.pagination.hasNextPage) {
            end = true;
            break;
          }
        }
      }

      // Cycle through all campaigns and calculate the amount raised for each cause
      let campaignAmountPounds = 0;
      for (const campaign of campaigns) {
        const campaignRegionId = campaign.node.region?.id || 0;
        const isAllCauseCampaign = !campaignRegionId || campaignRegionId === allCharitiesRegionId;

        // Detemine the cause amount
        let raisedAmount = parseFloat(campaign.node.totalAmountRaised?.value || '0');
        campaignAmountPounds += raisedAmount;

        // If the campaign donates to all charities, divide the amount by the number of causes
        let causeAmount = raisedAmount;
        if (isAllCauseCampaign) {
          causeAmount = raisedAmount / apiResponse.causes.length;
        }
        causeAmount = roundAmount(causeAmount);

        // Add the amount to the correct cause
        for (const cause of apiResponse.causes) {
          // If the campaign is for a specific cause or applies to all causes
          if (cause.id === campaignRegionId || isAllCauseCampaign) {
            // Add the amount to the correct cause (Yogscast or Fundraisers)
            if (campaign.node.user?.slug === env.YOGSCAST_USERNAME_SLUG) {
              cause.raised.yogscast += causeAmount;
            } else {
              cause.raised.fundraisers += causeAmount;
            }
          }
        }
      }

      // Clean up the raised amounts if the total raised amount is different from the sum of all campaign amounts
      const amountDifference = totalPounds - campaignAmountPounds;
      if (amountDifference > 0) {
        // Fix the summary data
        apiResponse.raised.yogscast += amountDifference;
        apiResponse.raised.fundraisers -= amountDifference;

        apiResponse.raised.yogscast = roundAmount(apiResponse.raised.yogscast);
        apiResponse.raised.fundraisers = roundAmount(apiResponse.raised.fundraisers);

        // Fix the cause data
        const causeAmount = amountDifference / apiResponse.causes.length;
        for (const cause of apiResponse.causes) {
          cause.raised.yogscast += causeAmount;
        }
      }

      // Any manual adjustments to causes? This is if manual donations are made to the entire fundraiser, but not to a specific cause
      for(const cause of causes){
        if(cause.override){
          for(const apiCause of apiResponse.causes){
            if(cause.id === apiCause.id){
              apiCause.raised.yogscast += cause.override;
            }

            apiCause.raised.yogscast -= cause.override/causes.length;
          }
        }
      }

      // Round the raised amounts for each cause
      for (const cause of apiResponse.causes) {
        cause.raised.fundraisers = roundAmount(cause.raised.fundraisers);
        cause.raised.yogscast = roundAmount(cause.raised.yogscast);
      }
    }

    // Create and format the campaign list from the Tiltify API data
    for (const campaign of campaigns) {
      const description = campaign.node.description?.length > maxDescriptionLength
        ? `${campaign.node.description.slice(0, maxDescriptionLength)}...`
        : campaign.node.description;

        // Skip campaigns without a user
        if(!campaign.node.user?.id){
          continue;
        }

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

    // Sort the campaigns by the amount raised and limit the number of campaigns
    apiResponse.campaigns.count = campaignsComputed.length;
    apiResponse.campaigns.list = sortByKey(campaignsComputed, 'raised').slice(0, maxNumOfCampaigns);

  } catch (e) {
    console.error(e);
  }

  return apiResponse;
}

// Get the default response data before any Tiltify or Yogscast API calls
async function getDefaultResponse(env: Env, date = new Date(), causes: Cause[] | null = null): Promise<ApiResponse> {
  let donationHistory: DonationHistory[] = [];

  try {
    if(!causes){
      causes = JSON.parse(await env.JINGLE_JAM_DATA.get('causes') || "") || [];
    }
  } catch { }

  try {
    donationHistory = JSON.parse(await env.JINGLE_JAM_DATA.get('summary') || "") || [];
  } catch { }

  const causeObjects: Cause[] = causes?.map(cause => ({
    id: cause.id,
    name: cause.name,
    logo: cause.logo,
    description: cause.description,
    url: cause.url,
    donateUrl: cause.donateUrl,
    raised: { yogscast: 0, fundraisers: 0 },
  })) || [];

  return {
    date: date,
    event: {
      year: env.YEAR,
      start: new Date(Date.UTC(env.YEAR, 11, 1, 17, 0, 0)),
      end: new Date(Date.UTC(env.YEAR, 11, 15, 0, 0, 0)),
    },
    avgConversionRate: env.CONVERSION_RATE,
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


const debugStartDate = new Date(2024, 10, 29, 7, 27, 0);
const debugEndDate = new Date(2024, 10, 30, 22, 10, 0);

// Create fake data for debugging purposes
async function getDebugData(env: Env): Promise<ApiResponse> {
  const defaultResponse = await getDefaultResponse(env);

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

// Get the latest data from the Tiltify and Yogscast APIs
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
