import {
  roundAmount,
  sortByKey
} from "./utils";

import {
  getCampaign,
  getEvent,
  getCampaigns
} from "./tiltify";

const maxSim = 6; //Maximum number of simultaneous fetches
const maxNumOfCampaigns = 100;
const maxDescriptionLength = 1024;
const maxCampaigns = (20 * 900) - 2; //Maximum number of campaigns that can be fetched
const allCharitiesRegionId = 566;

//Old Team
//End of 2020 yogscast dollar amount = 2827226.00
//End of 2021 yogscast dollar amount = 6571211.42

//New Uesr - @yogscast
//Pre-2022 Jingle Jam dollar amount = 36023.96
//End of 2022 yogscast dollar amount = 3368996.43
//Pre-2023 Jingle Jam dollar amount = 3371741.16

async function getSummaryData(env) {
  
  let apiResponse = getDefaultResponse(env);
  var campaignsComputed = [];

  try {
    /*
        INITIAL KV LOOKUPS
    */
    let causes = JSON.parse(await env.JINGLE_JAM_DATA.get('causes'));
    let defaultConversionRate = parseFloat(await env.JINGLE_JAM_DATA.get('conversion-rate'));
    let summary = JSON.parse(await env.JINGLE_JAM_DATA.get('summary'));

    apiResponse = getDefaultResponse(env, causes, summary, defaultConversionRate);

    /*
        INITIAL TILTIFY LOOKUPS
    */
    let requests = [
      getCampaign(env.YOGSCAST_USERNAME_SLUG, env.YOGSCAST_CAMPAIGN_SLUG), //Gets Yogscast Campaign Data
      getEvent(env.CAUSE_SLUG, env.FUNDRAISER_SLUG) //Gets Yearly Event Level Data
    ];

    //Get All Responses
    const results = await Promise.all(requests);

    let yogscastCampaign = results[0].data.campaign; //Yogscast Campaign Data
    let eventData = results[1].data; //Yearly Event Data

    /*
        SUMMARY DATA
    */
    //Gets donation amounts
    let totalPounds = parseFloat(eventData.fundraisingEvent?.totalAmountRaised.value ?? 0);
    let yogscastPounds = parseFloat(yogscastCampaign?.totalAmountRaised.value ?? 0);
    let yogscastDollars = roundAmount(parseFloat(yogscastCampaign?.user.totalAmountRaised.value ?? 0) - env.DOLLAR_OFFSET);
    let fundraiserPounds = roundAmount(totalPounds - yogscastPounds);

    apiResponse.raised.yogscast = yogscastPounds;
    apiResponse.raised.fundraisers = fundraiserPounds;

    //Gets average conversion rate
    apiResponse.avgConversionRate = defaultConversionRate;
    let division = yogscastDollars / yogscastPounds;
    if (!isNaN(division) && isFinite(division))
      apiResponse.avgConversionRate = roundAmount(division, 10);

    //Gets collections counts
    try {
      let rewards = (eventData.fundraisingEvent.rewards && eventData.fundraisingEvent.rewards.length > 0) ? eventData.fundraisingEvent.rewards : yogscastCampaign.rewards;
      if (rewards && rewards.length > 0) {
        apiResponse.collections.total = rewards[0].quantity;
        apiResponse.collections.redeemed = apiResponse.collections.total - rewards[0].remaining;
      }
    } catch (e) {
      apiResponse.collections.total = env.COLLECTIONS_AVAILABLE;
      apiResponse.collections.redeemed = 0;
    }

    apiResponse.donations.count = apiResponse.collections.redeemed + env.DONATION_DIFFERENCE;

    //Create the causes objects
    for (let charity of apiResponse.causes) {
      for (let defaultCauses of causes) {
        if (charity.id === defaultCauses.id) {
          charity.raised.yogscast = defaultCauses.overrideDollars / apiResponse.avgConversionRate;
          break;
        }
      }
    }

    /*
        CAMPAIGN DATA
    */
    var campaigns = [];
    try {
      let offset = 0;
      let end = false;

      if (env.FUNDRAISER_PUBLIC_ID) {
        // Lookup all the fundraiser campaigns
        while (offset <= maxCampaigns && !end) {
          let requests = [];

          // Start a batch of 6 campaign requests
          for (var j = 0; j < maxSim; j++) {
            requests.push(getCampaigns(env.FUNDRAISER_PUBLIC_ID, offset));
            offset += 20;
          }

          // Wait for all campaign requests to finish
          var regionResponses = await Promise.all(requests);

          // Go through each campaign response and add to the list
          for (let j = 0; j < regionResponses.length; j++) {
            let response = regionResponses[j].data.fundraisingEvent.publishedCampaigns;

            campaigns = campaigns.concat(response.edges);

            if (!response.pagination.hasNextPage) {
              end = true;
              break;
            }
          }
        }

        // Go through each campaign from the lookup and combine with the cause object
        for (let campaign of campaigns) {
          //Get needed data from the lookup
          let campaignRegionId = campaign.node.region?.id ?? 0;
          let isYogscastCampaign = campaign.node.user.slug === env.YOGSCAST_USERNAME_SLUG;
          let isAllCharitiesCampaign = !campaignRegionId || campaignRegionId === allCharitiesRegionId;

          let amount = parseFloat(campaign.node.totalAmountRaised.value);

          //If the charity is for all charities, divide it by the number of charities
          if (isAllCharitiesCampaign) {
            amount /= apiResponse.causes.length;
          }

          amount = roundAmount(amount);

          //Find the associated charity object
          for (let cause of apiResponse.causes) {
            if (cause.id == campaignRegionId || isAllCharitiesCampaign) {
              //If a yogscast charity
              if (isYogscastCampaign)
                cause.raised.yogscast += amount;
              else
                cause.raised.fundraisers += amount;
            }
          }
        }

        // Format all the cause raise amounts
        for (let cause of apiResponse.causes) {
          cause.raised.fundraisers = roundAmount(cause.raised.fundraisers);
          cause.raised.yogscast = roundAmount(cause.raised.yogscast);
        }
      }

    } catch (e) {
      console.log(e);
    }

    //Create the campaign objects for the API response
    for (let campaign of campaigns) {
      let description = campaign.node.description.length > maxDescriptionLength ? campaign.node.description.slice(0, maxDescriptionLength) + "..." : campaign.node.description;
      campaignsComputed.push({
        causeId: campaign.node.region?.id || null,
        name: campaign.node.name,
        description: description,
        slug: campaign.node.slug,
        url: `https://tiltify.com/@${campaign.node.user.slug}/${campaign.node.slug}`,
        startTime: campaign.node.publishedAt,
        raised: roundAmount(parseFloat(campaign.node.totalAmountRaised.value)),
        goal: roundAmount(parseFloat(campaign.node.goal.value)),
        livestream: {
          channel: campaign.node.livestream?.channel || campaign.node.user.social.twitch,
          type: campaign.node.livestream?.type || 'twitch'
        },
        user: {
          id: campaign.node.user.id,
          name: campaign.node.user.username,
          slug: campaign.node.user.slug,
          avatar: campaign.node.user.avatar.src,
          url: `https://tiltify.com/@${campaign.node.user.slug}`,
        }
      });
    }

    apiResponse.campaigns.count = campaignsComputed.length;
    apiResponse.campaigns.list = sortByKey(campaignsComputed, 'raised').slice(0, maxNumOfCampaigns);

  } catch (e) {
    console.log(e);
  }

  return apiResponse;
}

//Gets the default response object for the API
function getDefaultResponse(env, causes = [], summary = [], defaultConversionRate = 1, date = new Date()) {
  let causeObjects = [];

  //Create the causes objects
  for (let cause of causes) {
    var obj = {
      id: cause.id,
      name: cause.name,
      logo: cause.logo,
      description: cause.description,
      url: cause.url,
      donateUrl: cause.donateUrl,
      raised: {
        yogscast: 0,
        fundraisers: 0
      }
    };

    causeObjects.push(obj);
  }

  return {
    date: date,
    event: {
      year: env.YEAR,
      start: new Date(Date.UTC(env.YEAR, 11, 1, 17, 0, 0)),
      end: new Date(Date.UTC(env.YEAR, 11, 15, 0, 0, 0))
    },
    avgConversionRate: defaultConversionRate,
    raised: {
      yogscast: 0,
      fundraisers: 0
    },
    collections: {
      redeemed: 0,
      total: env.COLLECTIONS_AVAILABLE
    },
    donations: {
      count: 0
    },
    history: summary,
    causes: causeObjects,
    campaigns: {
      count: 0,
      list: []
    }
  };
}

const debugStartDate = new Date(2023, 9, 17, 20, 20, 10)
const debugEndDate = new Date(2023, 10, 13, 22, 10, 0)

//Generate mock data for testing if debug mode is enabled
async function getDebugData(env) {
  let causes = JSON.parse(await env.JINGLE_JAM_DATA.get('causes'));
  let defaultConversionRate = parseFloat(await env.JINGLE_JAM_DATA.get('conversion-rate'));
  let summary = JSON.parse(await env.JINGLE_JAM_DATA.get('summary'));

  let defaultResponse = getDefaultResponse(env, causes, summary, defaultConversionRate);

  defaultResponse.event.start = debugStartDate;
  defaultResponse.event.end = debugEndDate;

  let amount = 1 * Math.max(((new Date().getTime() - debugStartDate.getTime()) / 3.5913 % 5000000), 0);

  defaultResponse.raised.yogscast = amount * .8;
  defaultResponse.raised.fundraisers = amount * .2;

  defaultResponse.collections.redeemed = parseInt(amount / 40.84);
  defaultResponse.donations.count = defaultResponse.collections.redeemed + 945;

  for (let cause of defaultResponse.causes) {
    cause.raised.yogscast = amount / defaultResponse.causes.length * .8;
    cause.raised.fundraisers = amount / defaultResponse.causes.length * .2;
  }

  return defaultResponse;
}

//Performs the main data fetching and aggregation
export async function getLatestData(env) {
  env.DONATION_DIFFERENCE = parseInt(env.DONATION_DIFFERENCE);
  env.DOLLAR_OFFSET = parseFloat(env.DOLLAR_OFFSET);
  env.COLLECTIONS_AVAILABLE = parseInt(env.COLLECTIONS_AVAILABLE);
  env.YEAR = parseInt(env.YEAR);

  if (env.ENABLE_DEBUG)
    return await getDebugData(env);

  return await getSummaryData(env);
}