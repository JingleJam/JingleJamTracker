import {
  roundAmount,
  sortByKey,
  getRandomFloat
} from "./utils";

const maxSim = 6; //Maximum number of simultaneous fetches
const maxNumOfCampaigns = 100;
const maxDescriptionLength = 1024;

//Old Team
//End of 2020 yogscast dollar amount = 2827226.00
//End of 2021 yogscast dollar amount = 6571211.42

//New Uesr - @yogscast
//Pre-2022 Jingle Jam dollar amount = 36023.96
//End of 2022 yogscast dollar amount = 3368996.43

async function getSummaryData(env) {
  let tiltifyHeader = {
    headers: {
      "Authorization": "Bearer " + env.TILTIFY_API_TOKEN,
      "Content-Type": "application/json"
    }
  };

  let defaultResponse = getDefaultResponse(env);
  var campaignsComputed = [];

  try {
    /*
        INITIAL KV LOOKUPS
    */
    let causes = JSON.parse(await env.JINGLE_JAM_DATA.get('causes'));
    let defaultConversionRate = parseFloat(await env.JINGLE_JAM_DATA.get('conversion-rate'));
    let summary = JSON.parse(await env.JINGLE_JAM_DATA.get('summary'));

    defaultResponse = getDefaultResponse(env, causes, summary, defaultConversionRate);

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

    defaultResponse.raised.yogscast = yogscastPounds;
    defaultResponse.raised.fundraisers = fundraiserPounds;

    defaultResponse.avgConversionRate = defaultConversionRate;

    let division = yogscastDollars / yogscastPounds;
    if (!isNaN(division) && isFinite(division))
      defaultResponse.avgConversionRate = roundAmount(division, 10);

    //Gets collections counts
    try {
      let rewards = (eventData.fundraisingEvent.rewards && eventData.fundraisingEvent.rewards.length > 0) ? eventData.fundraisingEvent.rewards : yogscastCampaign.rewards;
      if (rewards && rewards.length > 0) {
        defaultResponse.collections.total = rewards[0].quantity;
        defaultResponse.collections.redeemed = defaultResponse.collections.total - rewards[0].remaining;
      }
    } catch (e) {
      defaultResponse.collections.total = env.COLLECTIONS_AVAILABLE;
      defaultResponse.collections.redeemed = 0;
    }

    defaultResponse.donations.count = defaultResponse.collections.redeemed + env.DONATION_DIFFERENCE;

    //Create the causes objects
    for (let charity of defaultResponse.causes) {
      for (let defaultCauses of causes) {
        if (charity.id === defaultCauses.id) {
          charity.raised.yogscast = defaultCauses.overrideDollars / defaultResponse.avgConversionRate;
          break;
        }
      }
    }

    /*
        CHARITY DATA
    */
    var campaigns = [];
    try {
      let offset = 0;
      let end = false;

      if (env.FUNDRAISER_PUBLIC_ID) {
        // Lookup all the fundraiser campaigns
        while (offset <= 20 * 48 && !end) {
          let requests = [];

          for (var j = 0; j < maxSim; j++) {
            requests.push(getCampaigns(env.FUNDRAISER_PUBLIC_ID, offset));
            offset += 20;
          }

          var regionResponses = await Promise.all(requests);

          for (let j = 0; j < regionResponses.length; j++) {
            let response = regionResponses[j].data.fundraisingEvent.publishedCampaigns;

            campaigns = campaigns.concat(response.edges);

            if (!response.pagination.hasNextPage) {
              end = true;
              break;
            }
          }
        }

        // Go through each campaign from the lookup and combine with the charity object
        for (let campaign of campaigns) {
          //Get needed data from the lookup
          let regionId = campaign.node.region?.id ?? 0;
          let allCharitiesRegionId = 566;
          let isYogscast = campaign.node.user.slug === env.YOGSCAST_USERNAME_SLUG;
          let isAllCharities = !regionId || regionId === allCharitiesRegionId;

          let amount = parseFloat(campaign.node.totalAmountRaised.value);

          //If the charity is for all charities, divide it by the number of charities
          if (isAllCharities) {
            amount /= defaultResponse.causes.length;
          }

          amount = roundAmount(amount);

          //Find the associated charity object
          for (let charityObject of defaultResponse.causes) {
            if (charityObject.id == regionId || isAllCharities) {
              //If a yogscast charity
              if (isYogscast)
                charityObject.raised.yogscast += amount;
              else
                charityObject.raised.fundraisers += amount;
            }
          }
        }

        for (let cause of defaultResponse.causes) {
          cause.raised.fundraisers = roundAmount(cause.raised.fundraisers);
          cause.raised.yogscast = roundAmount(cause.raised.yogscast);
        }
      }

    } catch (e) {
      console.log(e);
    }

    //Update campaigns after creation;
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

    defaultResponse.campaigns.count = campaignsComputed.length;
    defaultResponse.campaigns.list = sortByKey(campaignsComputed, 'raised').slice(0, maxNumOfCampaigns);

  } catch (e) {
    console.log(e);
  }

  return defaultResponse;
}

function getDefaultResponse(env, causes = [], summary = [], defaultConversionRate = 1, date = new Date()) {
  let causeObjects = [];

  //Create the charity objects
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

async function getCampaign(userSlug, campaignSlug) {
  let request = {
    body: JSON.stringify({
      "operationName": "get_campaign_by_vanity_and_slug",
      "variables": {
        "vanity": "@" + userSlug,
        "slug": campaignSlug
      },
      "query": "query get_campaign_by_vanity_and_slug($vanity: String!, $slug: String!) { campaign(vanity: $vanity, slug: $slug) { publicId legacyCampaignId name slug status originalGoal { value } region { name } totalAmountRaised { value } goal { value } user { id username slug totalAmountRaised { value } } cause { id name slug } fundraisingEvent { publicId legacyFundraisingEventId name slug } livestream { channel type } rewards { amount { value } quantity remaining } } } "
    }),
    method: "POST",
    headers: {
      "content-type": "application/json",
    }
  };

  let response = await fetch("https://api.tiltify.com/", request)

  return await response.json();
}

async function getEvent(causeSlug, fundraiserSlug) {
  let request = {
    body: JSON.stringify({
      "operationName": "get_cause_and_fe_by_slug",
      "variables": {
        "causeSlug": causeSlug,
        "feSlug": fundraiserSlug
      },
      "query": "query get_cause_and_fe_by_slug($feSlug: String!, $causeSlug: String!) { fundraisingEvent(slug: $feSlug, causeSlug: $causeSlug) { amountRaised { currency value } rewards { quantity remaining } totalAmountRaised { value } } } "
    }),
    method: "POST",
    headers: {
      "content-type": "application/json",
    }
  };

  let response = await fetch("https://api.tiltify.com/", request)

  return await response.json();
}

async function getCampaigns(fundraiserPublicId, offset) {
  let request = {
    body: JSON.stringify({
      "operationName": "get_campaigns_by_fundraising_event_id",
      "variables": {
        "limit": 20,
        "offset": offset,
        "query": null,
        "regionId": null,
        "publicId": fundraiserPublicId
      },
      "query": "query get_campaigns_by_fundraising_event_id($publicId: String!, $limit: Int!, $query: String, $offset: Int, $regionId: Int) { fundraisingEvent(publicId: $publicId) { publishedCampaigns( limit: $limit offset: $offset query: $query regionId: $regionId ) { pagination { hasNextPage limit offset total } edges { node {... on Campaign { publishedAt description name slug user { avatar { src } id username slug social { twitch } } region { id } totalAmountRaised { value } livestream { channel type } goal { value } } } } } } }"
    }),
    method: "POST",
    headers: {
      "content-type": "application/json",
    }
  };

  let response = await fetch("https://api.tiltify.com/", request)

  let data = await response.json();

  return data;
}

const debugStartDate = new Date(2023, 9, 17, 20, 20, 10)
const debugEndDate = new Date(2023, 10, 13, 22, 10, 0)

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

//Gets the Latest Tiltify Data
async function getTiltifyData(env) {
  env.DONATION_DIFFERENCE = parseInt(env.DONATION_DIFFERENCE);
  env.DOLLAR_OFFSET = parseFloat(env.DOLLAR_OFFSET);
  env.COLLECTIONS_AVAILABLE = parseInt(env.COLLECTIONS_AVAILABLE);
  env.YEAR = parseInt(env.YEAR);

  if (env.ENABLE_DEBUG)
    return await getDebugData(env);

  return await getSummaryData(env);
}

module.exports = {
  getTiltifyData
}