import {
  summary,
  getTotals
} from "./data";

const maxSim = 6; //Maximum number of simultaneous fetches
const defaultConversionRate = 1.21;

const charities = [
  { id: 1, regionId: 566, name: 'All Charities',                             overrideDollars: 0},
  { id: 2, regionId: 576, name: 'British Red Cross',                         overrideDollars: 0},
  { id: 3, regionId: 575, name: 'Campaign Against Living Miserably (CALM)',  overrideDollars: 0},
  { id: 4, regionId: 564, name: 'Dogs For Autism',                           overrideDollars: 5000},
  { id: 5, regionId: 565, name: 'The Grand Appeal',                          overrideDollars: 5000},
  { id: 6, regionId: 567, name: "Huntington's Disease Association",          overrideDollars: 5000},
  { id: 7, regionId: 568, name: 'Kidscape',                                  overrideDollars: 0},
  { id: 8, regionId: 569, name: 'Mermaids',                                  overrideDollars: 0},
  { id: 9, regionId: 570, name: 'Movember',                                  overrideDollars: 10000},
  { id: 10, regionId: 571, name: 'RESET Mental Health',                       overrideDollars: 0},
  { id: 11, regionId: 572, name: 'SpecialEffect',                             overrideDollars: 0},
  { id: 12, regionId: 573, name: 'Special Olympics Great Britain',            overrideDollars: 20000},
  { id: 12, regionId: 574, name: 'Whale and Dolphin Conservation',            overrideDollars: 5000},
];
const defaultCharity = charities[0];

//Old Team
//End of 2020 yogscast dollar amount = 2827226.00
//End of 2021 yogscast dollar amount = 6571211.42

//New Uesr - @yogscast
//Pre-2022 Jingle Jam dollar amount = 36023.96
//End of 2022 yogscast dollar amount = 3367627.43

async function getSummaryData(env) {
  let tiltifyHeader = {
    headers: {
      "Authorization": "Bearer " + env.TILTIFY_API_TOKEN,
      "Content-Type": "application/json"
    }
  };

  let defaultResponse = getDefaultResponse(env);

  try{
    /*
        INITIAL LOOKUPS
    */
    let requests = [
      getCampaign(env.YOGSCAST_USERNAME_SLUG, env.YOGSCAST_CAMPAIGN_SLUG), //Gets Yogscast Campaign Data
      getEvent(env.CAUSE_SLUG, env.FUNDRAISER_SLUG) //Gets Yearly Event Level Data
    ];

    let retrieveDate = new Date();

    //Get All Responses
    const results = await Promise.all(requests);

    let yogscastCampaign = results[0].data.campaign; //Yogscast Campaign Data
    let eventData = results[1].data; //Yearly Event Data

    /*
        SUMMARY DATA
    */
    //Gets donation amounts
    defaultResponse.total.pounds = roundAmount(parseFloat(eventData.fundraisingEvent.amountRaised.value));
    defaultResponse.raised.pounds = roundAmount(parseFloat(yogscastCampaign.totalAmountRaised.value));
    defaultResponse.fundraisers.pounds = roundAmount(defaultResponse.total.pounds - defaultResponse.raised.pounds);
    
    defaultResponse.raised.dollars = roundAmount(parseFloat(yogscastCampaign.user.totalAmountRaised.value) - env.DOLLAR_OFFSET);

    defaultResponse.poundsToDollars = defaultConversionRate;

    let division = defaultResponse.raised.dollars/defaultResponse.raised.pounds;
    if(!isNaN(division) && isFinite(division))
      defaultResponse.poundsToDollars = roundAmount(division, 8);
    
    defaultResponse.fundraisers.dollars = roundAmount(defaultResponse.raised.pounds * defaultResponse.poundsToDollars);
    defaultResponse.total.dollars = roundAmount(defaultResponse.fundraisers.dollars + defaultResponse.raised.dollars);
    
    defaultResponse.entire.amount.dollars = roundAmount(defaultResponse.entire.amount.dollars + defaultResponse.total.dollars);
    defaultResponse.entire.amount.pounds = roundAmount(defaultResponse.entire.amount.pounds + defaultResponse.total.pounds);
    
    //Gets bundle counts
    if(eventData.fundraisingEvent.rewards && eventData.fundraisingEvent.rewards.length > 0){
      defaultResponse.bundles.allocated = eventData.fundraisingEvent.rewards[0].quantity;
      defaultResponse.bundles.remaining = eventData.fundraisingEvent.rewards[0].remaining;
      
      defaultResponse.bundles.sold = defaultResponse.bundles.allocated - defaultResponse.bundles.remaining;
    }

    defaultResponse.donations.count = defaultResponse.bundles.sold + env.DONATION_DIFFERENCE;
    defaultResponse.entire.donations += defaultResponse.donations.count;

    //Create the charity objects
    for (let charity of defaultResponse.campaigns) {
      for(let defaultCharity of charities){
        if(charity.id === defaultCharity.id){
          charity.fundraisers.dollars = defaultCharity.overrideDollars;
          charity.fundraisers.pounds = defaultCharity.overrideDollars/defaultResponse.poundsToDollars;
          break;
        }
      }
    }

    /*
        CHARITY DATA
    */
    try {
      let offset = 0;
      var campaigns = [];
      let end = false;

      
      // Lookup all the fundraiser campaigns
      while(offset <= 20*48 && !end) {
        let requests = [];

        for (var j = 0; j < maxSim; j++) {
          requests.push(getCampaigns(env.FUNDRAISER_PUBLIC_ID, offset));
          offset += 20;
        }

        var regionResponses = await Promise.all(requests);

        for(let j = 0; j < regionResponses.length; j++){
          let response = regionResponses[j].data.fundraisingEvent.publishedCampaigns;
          
          campaigns = campaigns.concat(response.edges);

          if(!response.pagination.hasNextPage){
            end = true;
            break;
          }
        }
      }

      // Go through each campaign from the lookup and combine with the charity object
      for (let campaign of campaigns) {
        //Get needed data from the lookup
        let region = campaign.node.region;
        let regionId = region ? region.id : defaultCharity.regionId;

        let userSlug = campaign.node.user.slug;

        let amount = roundAmount(parseFloat(campaign.node.totalAmountRaised.value));

        //Find the associated charity object
        for(let charityObject of defaultResponse.campaigns){
          if(charityObject.regionId == regionId){
            //If a yogscast charity
            if(userSlug === env.YOGSCAST_USERNAME_SLUG)
              charityObject.raised.pounds += amount;
            else
              charityObject.fundraisers.pounds += amount;
          }
        }
      }
    } catch (e) {
      console.log(e);
    }

    //Update campaigns after creation;
    for (let campaign of defaultResponse.campaigns) {
      campaign.raised.pounds = roundAmount(campaign.raised.pounds);
      campaign.fundraisers.pounds = roundAmount(campaign.fundraisers.pounds);
      campaign.total.pounds = roundAmount(campaign.raised.pounds + campaign.fundraisers.pounds);

      campaign.total.dollars = roundAmount(campaign.total.pounds * defaultResponse.poundsToDollars);
      campaign.fundraisers.dollars = roundAmount(campaign.fundraisers.pounds * defaultResponse.poundsToDollars);
      campaign.raised.dollars = roundAmount(campaign.raised.pounds * defaultResponse.poundsToDollars);
    }

  } catch(e){
    console.log(e);
  }

  return defaultResponse;
}

function getDefaultResponse(env, date = new Date()){
  let charityObjects = [];

  //Create the charity objects
  for (let charity of charities) {
    var obj = {
      id: charity.id,
      regionId: charity.regionId,
      name: charity.name,
      raised: {
        dollars: 0,
        pounds: 0
      },
      fundraisers: {
        dollars: 0,
        pounds: 0
      },
      total: {
        dollars: 0,
        pounds: 0,
      }
    };

    charityObjects.push(obj);
  }

  let entireTotals = getTotals();

  return {
    year: env.YEAR,
    name: env.NAME,
    date: date,
    poundsToDollars: defaultConversionRate,
    raised: {
      dollars: 0,
      pounds: 0
    },
    fundraisers: {
      dollars: 0,
      pounds: 0
    },
    total: {
      dollars: 0,
      pounds: 0
    },
    bundles: {
      sold: 0,
      remaining: 0,
      available: env.KEYS_AVAILABLE,
      allocated: 0
    },
    donations: {
      count: 0
    },
    average: {
      dollars: 0,
      pounds: 0
    },
    years: summary,
    entire: {
      amount: {
        dollars: roundAmount(entireTotals.dollars),
        pounds: roundAmount(entireTotals.pounds)
      },
      donations: entireTotals.donations
    },
    campaigns: charityObjects
  };
}

async function getCampaign(userSlug, campaignSlug){
  let request = {
    body: JSON.stringify({
      "operationName": "get_campaign_by_vanity_and_slug",
      "variables": {
        "vanity": "@" + userSlug,
        "slug": campaignSlug
      },
      "query": "query get_campaign_by_vanity_and_slug($vanity: String!, $slug: String!) { campaign(vanity: $vanity, slug: $slug) { publicId legacyCampaignId name slug status originalGoal { value } region { name } supportingType team { id name slug } totalAmountRaised { value } goal { value } user { id username slug totalAmountRaised { value } } cause { id name slug } fundraisingEvent { publicId legacyFundraisingEventId name slug } } } "
    }),
    method: "POST",
    headers: {
      "content-type": "application/json",
    }
  };

  let response = await fetch("https://api.tiltify.com/", request)

  return await response.json();
}

async function getEvent(causeSlug, fundraiserSlug){
  let request = {
    body: JSON.stringify({
      "operationName": "get_cause_and_fe_by_slug",
      "variables": {
        "causeSlug": causeSlug,
        "feSlug": fundraiserSlug
      },
      "query": "query get_cause_and_fe_by_slug($feSlug: String!, $causeSlug: String!) { fundraisingEvent(slug: $feSlug, causeSlug: $causeSlug) { amountRaised { currency value } rewards { quantity remaining } } } "
    }),
    method: "POST",
    headers: {
      "content-type": "application/json",
    }
  };

  let response = await fetch("https://api.tiltify.com/", request)

  return await response.json();
}

  async function getCampaigns(fundraiserPublicId, offset){
    let request = {
      body: JSON.stringify({
        "operationName": "get_campaigns_by_fundraising_event_id",
        "variables": {
          "limit":20,
          "offset":offset,
          "query":null,
          "regionId":null,
          "publicId":fundraiserPublicId
        },
        "query": "query get_campaigns_by_fundraising_event_id($publicId: String!, $limit: Int!, $query: String, $offset: Int, $regionId: Int) { fundraisingEvent(publicId: $publicId) { publishedCampaigns( limit: $limit offset: $offset query: $query regionId: $regionId ) { pagination { hasNextPage limit offset total } edges { cursor node { publicId name slug user { id username slug } region { id } team { id slug } totalAmountRaised { value } } } } } } "
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

function roundAmount(val, decimals = 2) {
  return +(Math.round(val + "e+" + decimals) + ("e-" + decimals));
}

//Gets the Latest Tiltify Data
async function getTiltifyData(env) {
  env.DONATION_DIFFERENCE = parseInt(env.DONATION_DIFFERENCE);
  env.DOLLAR_OFFSET = parseFloat(env.DOLLAR_OFFSET);
  env.KEYS_AVAILABLE = parseInt(env.KEYS_AVAILABLE);
  env.YEAR = parseInt(env.YEAR);

  return await getSummaryData(env);
}

module.exports = {
  getTiltifyData
}