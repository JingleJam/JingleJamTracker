import { generateSlug, roundAmount, sortByKey } from "tiltify-cache/utils";
import { getEvent, getCampaigns, getUserBySlug } from "tiltify-cache/dependencies/tiltify";
import { get as getYogscastAPI } from "tiltify-cache/dependencies/yogscast";
import { ApiResponse } from "tiltify-cache/types/ApiResponse";
import { Env } from "tiltify-cache/types/env";
import { Cause } from "tiltify-cache/types/Cause";
import { DonationHistory } from "tiltify-cache/types/DonationHistory";
import { YogscastDonationData } from "tiltify-cache/types/yogscast/YogscastDonationData";
import { Campaign } from "tiltify-cache/types/Campaign";
import { TiltifyMultiSearchCampaign, TiltifyMultiSearchResult } from "tiltify-cache/types/tiltify/TiltifyMultiSearchCampaign";
import { TiltifyTemplateFact } from "./types/tiltify/TiltifyTemplateFact";
import { TiltifyUser } from "./types/tiltify/TiltifyUser";

const maxSim = 6; // Maximum number of simultaneous fetches
const maxDescriptionLength = 1024;
const maxCampaigns = (20 * 900) - 2; // Maximum number of campaigns that can be fetched
const allCharitiesRegionId = "566";

// Old Team Data
// End of 2020 yogscast dollar amount = 2827226.00
// End of 2021 yogscast dollar amount = 6571211.42

// New User - @yogscast
// Pre-2022 Jingle Jam dollar amount = 36023.96
// End of 2022 yogscast dollar amount = 3368996.43
// Pre-2023 Jingle Jam dollar amount = 3371741.16
// End of 2023 yogscast dollar amount = 5747814.82
// Pre-2024 Jingle Jam dollar amount = 8215739.75
async function getSummaryData(env: Env): Promise<ApiResponse> {
  let campaignsComputed: Campaign[] = [];
  
  let causes: Cause[] = JSON.parse(await env.JINGLE_JAM_DATA.get('causes') || "") || [];

  let apiResponse = await getDefaultResponse(env, new Date(), causes);

  try {
    // Perform all Tiltify and Yogscast lookups in parallel
    const results = await Promise.all([
      getEvent(env.FUNDRAISER_PUBLIC_ID),       // Gets Yearly Event Level Data
      getYogscastAPI(),                         // Gets Yogscast API Data
      getUserBySlug(env.YOGSCAST_USERNAME)      // Gets Yogscast User Data
    ]);

    const eventData: TiltifyTemplateFact | null = results[0] as TiltifyTemplateFact | null;
    const yogscastAPI: YogscastDonationData | null = results[1] as YogscastDonationData | null;
    const yogscastUser: TiltifyUser | null = results[2] as TiltifyUser | null;

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
    apiResponse.raised = parseFloat(eventData?.totalAmountRaised.value || "0");

    // Gets collections counts
    try {
      const rewards = (eventData?.rewards?.length || 0) > 0 ? eventData?.rewards : 0;
      if (rewards && rewards.length > 0) {
        apiResponse.collections.total = rewards[0].quantity;
        apiResponse.collections.redeemed = apiResponse.collections.total - rewards[0].remaining;
      }
    } catch {
      apiResponse.collections.total = env.COLLECTIONS_AVAILABLE;
      apiResponse.collections.redeemed = 0;
    }

    // Get donation counts from Yogscast API

    // If the average donation is less than 10, don't use the donations from the Yogscast API
    try {
      if(yogscastAPI?.donations && (apiResponse.raised/yogscastAPI?.donations) > 10) {
        apiResponse.donations = (yogscastAPI?.donations - yogscastAPI?.donations_with_reward) + apiResponse.collections.redeemed || 0;
      } else {
        apiResponse.donations = apiResponse.collections.redeemed;
      }
    } catch {
      apiResponse.donations = apiResponse.collections.redeemed;
    }

    /*
      Campaigns:
        - Campaign List
        - Raised for each Cause
    */

    // Get the list of campaigns
    let campaigns: TiltifyMultiSearchCampaign[] = [];
    let offset = 0;
    let end = false;

    // Get all campaigns from the fundraiser
    if (env.FUNDRAISER_PUBLIC_ID) {
      // Fetch all campaigns in parallel (chunks of 6 requests with 100 campaigns each)
      while (offset <= maxCampaigns && !end) {
        const requests = Array.from({ length: maxSim }, (_, i) => getCampaigns(env.FUNDRAISER_PUBLIC_ID, offset + i));
        const regionResponses: TiltifyMultiSearchResult[] = await Promise.all(requests);
        offset += maxSim;

        for (const response of regionResponses) {
          campaigns = campaigns.concat(response.hits);

          // Check if we've reached the last page
          if (response.page >= response.totalPages) {
            end = true;
            break;
          }
        }
      }

      // Cycle through all campaigns and calculate the amount raised for each cause
      let campaignAmountPounds = 0;
      for (const campaign of campaigns) {
        const campaignRegionId = campaign.region_id?.toString() || null;
        const isAllCauseCampaign = !campaignRegionId || campaignRegionId === allCharitiesRegionId;

        // Determine the cause amount
        let raisedAmount = campaign.total_amount_raised || 0;
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
          if (cause.legacyId === campaignRegionId || isAllCauseCampaign) {
            cause.raised += causeAmount;
          }
        }
      }

      // Clean up the raised amounts if the total raised amount is different from the sum of all campaign amounts
      // This is mainly team donations that are not assigned to a specific campaign
      const amountDifference = apiResponse.raised - campaignAmountPounds;
      if (amountDifference > 0) {
        // Fix the cause data
        const causeAmount = amountDifference / apiResponse.causes.length;
        for (const cause of apiResponse.causes) {
          cause.raised += causeAmount;
        }
      }

      // Any manual adjustments to causes? This is if manual donations are made to the entire fundraiser, but not to a specific cause
      for(const cause of causes){
        if(cause.override){
          for(const apiCause of apiResponse.causes){
            if(cause.id === apiCause.id){
              apiCause.raised += cause.override;
            }

            apiCause.raised -= cause.override/causes.length;
          }
        }
      }

      // Round the raised amounts for each cause
      for (const cause of apiResponse.causes) {
        cause.raised = roundAmount(cause.raised);
      }
    }

    // Get the Yogscast total amount raised to calculate the average conversion rate
    let yogscastRaisedDollars = Math.max(parseFloat(yogscastUser?.totalAmountRaised.value || "0") - env.DOLLAR_OFFSET, 0);
    let yogscastRaisedPounds = campaigns.find(campaign => campaign.username === env.YOGSCAST_USERNAME)?.total_amount_raised || 0;

    try {
      apiResponse.dollarConversionRate = parseFloat((yogscastRaisedDollars/yogscastRaisedPounds).toFixed(8)) || env.CONVERSION_RATE;
    } catch {
      apiResponse.dollarConversionRate = env.CONVERSION_RATE;
    }


    // Generate legacy cause id to cause id mapping
    const legacyCauseIdToCauseId: Record<string, string> = {};
    for (const cause of apiResponse.causes) {
      legacyCauseIdToCauseId[cause.legacyId!] = cause.id;
    }

    // Create and format the campaign list from the Tiltify API data
    for (const campaign of campaigns) {
      const description = campaign.description?.length > maxDescriptionLength
        ? `${campaign.description.slice(0, maxDescriptionLength)}...`
        : campaign.description;

      // Skip campaigns without a username or if not published
      if (!campaign.username) {
        continue;
      }

      // Extract slug from URL or use clean_name converted to slug format
      const slug = campaign.url?.split('/').pop() || campaign.clean_name?.toLowerCase().replace(/\s+/g, '-') || '';

      // Get the user slug by replaccing the username with lowercase and dashes
      const userSlug = generateSlug(campaign.username) || '';
      const teamSlug = generateSlug(campaign.team_name) || '';

      // Get the cause id from the legacy cause id
      const causeId = legacyCauseIdToCauseId[campaign.region_id?.toString()];

      // Increment the campaign count for the cause
      if (causeId) {
        for (const cause of apiResponse.causes) {
          if (cause.id === causeId) {
            cause.campaigns++;
            break;
          }
        } 
      }

      campaignsComputed.push({
        id: campaign.id,
        slug: slug,
        name: campaign.name,
        description: description,
        url: campaign.url || `https://tiltify.com/@${campaign.username}/${slug}`,
        startTime: campaign.published_at_utc ? new Date(campaign.published_at_utc * 1000).toISOString(): null,
        raised: roundAmount(campaign.total_amount_raised || 0),
        goal: roundAmount(campaign.goal || 0),
        causeId: causeId || null,
        type: campaign.type,
        team: campaign.team_public_id ? {
          name: campaign.team_name || '',
          slug: teamSlug,
          avatar: campaign.team_avatar?.src || '',
          url: `https://tiltify.com/+${teamSlug}`,
        } : null,
        user: {
          name: campaign.username,
          slug: userSlug,
          avatar: campaign.user_avatar?.src || campaign.fact_avatar?.src || '',
          url: `https://tiltify.com/@${userSlug}`,
        },
      });
    }

    // Sort the campaigns by the amount raised and limit the number of campaigns
    apiResponse.campaigns.count = campaignsComputed.length;
    apiResponse.campaigns.list = sortByKey(campaignsComputed, 'raised');

    // Remove the legacyId from the causes
    for(const cause of apiResponse.causes){
      delete cause.legacyId;
    }

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
    legacyId: cause.legacyId || '',
    name: cause.name,
    logo: cause.logo,
    description: cause.description,
    color: cause.color,
    url: cause.url,
    donateUrl: cause.donateUrl,
    raised: 0,
    campaigns: 0,
  })) || [];

  return {
    date: date,
    event: {
      year: env.YEAR,
      start: new Date(Date.UTC(env.YEAR, 11, 1, 17, 0, 0)),
      end: new Date(Date.UTC(env.YEAR, 11, 15, 8, 0, 0)),   //December 15 (ending 08:00 AM GMT)
    },
    raised: 0,
    dollarConversionRate: env.CONVERSION_RATE,
    collections: {
      redeemed: 0,
      total: env.COLLECTIONS_AVAILABLE,
    },
    donations: 0,
    history: donationHistory || [],
    causes: causeObjects,
    campaigns: {
      count: 0,
      list: [],
    },
  };
}


const debugStartDate = new Date(Date.now() + 1 * 60 * 1000);
const debugEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

// Create fake data for debugging purposes
async function getDebugData(env: Env): Promise<ApiResponse> {
  const defaultResponse = await getDefaultResponse(env);

  defaultResponse.event.start = debugStartDate;
  defaultResponse.event.end = debugEndDate;

  const amount = 1 * Math.max(((new Date().getTime() - debugStartDate.getTime()) / 3.5913 % 5000000), 0);

  defaultResponse.raised = amount;

  defaultResponse.collections.redeemed = parseInt((amount / 40.84).toFixed(0));
  defaultResponse.donations = defaultResponse.collections.redeemed + 945;

  for (const cause of defaultResponse.causes) {
    cause.raised = (amount / defaultResponse.causes.length);
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
