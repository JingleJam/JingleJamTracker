import {
  summary,
  getTotals
} from "./data";

const maxSim = 6; //Maximum number of simultaneous fetches

const regionIds = [
  { id: 566, name: 'All Charities'},
  { id: 576, name: 'British Red Cross'},
  { id: 575, name: 'Campaign Against Living Miserably (CALM)'},
  { id: 564, name: 'Dogs For Autism'},
  { id: 565, name: 'The Grand Appeal'},
  { id: 567, name: "Huntington's Disease Association"},
  { id: 568, name: 'Kidscape'},
  { id: 569, name: 'Mermaids'},
  { id: 570, name: 'Movember'},
  { id: 571, name: 'RESET Mental Health'},
  { id: 572, name: 'SpecialEffect'},
  { id: 573, name: 'Special Olympics Great Britain'},
  { id: 574, name: 'Whale and Dolphin Conservations'},
]

//End of 2020 yogscast dollar amount = 2827226.00
//End of 2021 yogscast dollar amount = 6571211.42

async function getSummaryData(env) {
  let tiltifyHeader = {
    headers: getTiltifyHeader(env),
  };

  var requests = [
    getTeam(env.TEAM_ID, tiltifyHeader), //Only used for getting dollar amount and the username
    getEvent(env.CAUSE_SLUG, env.FUNDRAISER_SLUG) //Gets list of official yogscast campaigns
  ];

  var retrieveDate = new Date();

  //Get All Responses
  const results = await Promise.all(requests);

  //Individual Results
  var team = results[0].data; //Yogscast Team Data
  var totals = results[1].data; //List of Yogscast Campaigns

  //Combine all campaign data
  var campaignObjs = [];
  let totalPounds = roundAmount(parseFloat(totals.fundraisingEvent.amountRaised.value));

  //For all offical campaigns
  for (var i = 0; i < regionIds.length; i++) {
    var region = regionIds[i];

    //Create individual campaign object
    var obj = {
      id: region.id,
      slug: region.id,
      name: region.name,
      currency: 'GBP',
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

    campaignObjs.push(obj);
  }

  let yogscastTotalPounds = 0;
  let fundraiserTotalPounds = 0;
  let allFundraiserTotalPounds = 0;

  try {
    if(true){

      let offset = 0;
      var campaigns = [];
      let end = false;

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
  
      for (let campaign of campaigns) {
        let region = campaign.node.region;

        let amount = parseFloat(campaign.node.totalAmountRaised.value);

        let regionId = 566;
        let isYogscast = false;

        if(region){
          regionId = region.id;
        }
        else{
          isYogscast = true;
        }

        for(let campaignObj of campaignObjs){
          if(campaignObj.id == regionId){
            if(isYogscast){
              campaignObj.raised.pounds += amount;

              yogscastTotalPounds += amount;
            }
            else{
              campaignObj.fundraisers.pounds += amount;
  
              fundraiserTotalPounds += amount;

              if(regionId === 566){
                allFundraiserTotalPounds += amount;
              }
            }

            campaignObj.total.pounds = campaignObj.raised.pounds + campaignObj.fundraisers.pounds;
          }
        }
      }
    }
  } catch (e) {
    console.log(e);
  }

  var currencyConversion = 1.21;

  let totalDollars = roundAmount(totalPounds * currencyConversion);
  
  let fundraiserTotalDollars = roundAmount(fundraiserTotalPounds * currencyConversion);

  let yogscastDollars = roundAmount(totalDollars - fundraiserTotalDollars);
  
  for(let campaign of campaignObjs){
    if(campaign.id === 566){
      campaign.raised.pounds = yogscastTotalPounds;
      campaign.fundraisers.pounds = allFundraiserTotalPounds;
      campaign.total.pounds = allFundraiserTotalPounds + yogscastTotalPounds;
      break;
    }
  }

  //Update campaigns after creation;
  for (let campaign of campaignObjs) {
    campaign.total.dollars = roundAmount(campaign.total.pounds * currencyConversion);
    campaign.fundraisers.dollars = roundAmount(campaign.fundraisers.pounds * currencyConversion);
    campaign.raised.dollars = roundAmount(campaign.raised.pounds * currencyConversion);
  }

  let totalBundlesAllocated = totals.fundraisingEvent.rewards[0].quantity;
  let totalBundlesRemaining = totals.fundraisingEvent.rewards[0].remaining;
  let totalBundlesSold = totalBundlesAllocated - totalBundlesRemaining;

  var numberOfDonations = totalBundlesSold + env.DONATION_DIFFERENCE;

  let entireTotals = getTotals();
  entireTotals.dollars += roundAmount(totalPounds * currencyConversion);
  entireTotals.pounds += roundAmount(totalPounds);

  let response = new Response(
    JSON.stringify({
      year: env.YEAR,
      name: env.NAME,
      date: retrieveDate,
      poundsToDollars: roundAmount(currencyConversion, 8),
      raised: {
        dollars: yogscastDollars,
        pounds: yogscastTotalPounds
      },
      fundraisers: {
        dollars: fundraiserTotalDollars,
        pounds: fundraiserTotalPounds
      },
      total: {
        dollars: totalDollars,
        pounds: totalPounds
      },
      bundles: {
        sold: totalBundlesSold,
        remaining: totalBundlesRemaining,
        available: env.KEYS_AVAILABLE,
        allocated: totalBundlesAllocated
      },
      donations: {
        count: numberOfDonations
      },
      average: {
        dollars: roundAmount((totalPounds * currencyConversion) / numberOfDonations),
        pounds: roundAmount(totalPounds / numberOfDonations)
      },
      years: summary,
      entire: {
        amount: {
          dollars: entireTotals.dollars,
          pounds: entireTotals.pounds
        },
        donations: entireTotals.donations
      },
      campaigns: campaignObjs
    }), {
      headers: {
        "content-type": "application/json;charset=UTF-8",
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Max-Age': '86400',
        'Allow': 'GET, HEAD, OPTIONS',
        'Vary': 'Origin'
      }
    }
  );

  return response;
}

async function getTeam(teamId, tiltifyHeader){
  let response = await  fetch("https://tiltify.com/api/v3/teams/" + teamId, tiltifyHeader)

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

async function getCampaignsForRegion(fundraiserPublicId, regionId){
  let request = {
    body: JSON.stringify({
      "operationName": "get_campaigns_by_fundraising_event_id_asc",
      "variables": {
        "publicId": fundraiserPublicId,
        "regionId": regionId,
        'limit': 50
      },
      "query": "query get_campaigns_by_fundraising_event_id_asc($publicId: String!, $limit: Int!, $query: String, $cursor: String, $regionId: Int) { fundraisingEvent(publicId: $publicId) { publishedCampaigns( first: $limit after: $cursor query: $query regionId: $regionId ) { pageInfo { startCursor endCursor hasNextPage hasPreviousPage } edges { cursor node { publicId name slug user { id username slug } team { id name slug } cause { slug name } totalAmountRaised { value currency }  } } } } }"
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

//Handle Requests

async function handleRequest(request) {
  request.env.DEFAULT_BUNDLES_PER_CAMPAIGN = parseInt(request.env.DEFAULT_BUNDLES_PER_CAMPAIGN);
  request.env.DOLLAR_OFFSET = parseFloat(request.env.DOLLAR_OFFSET);
  request.env.DONATION_DIFFERENCE = parseInt(request.env.DONATION_DIFFERENCE);
  request.env.KEYS_AVAILABLE = parseInt(request.env.KEYS_AVAILABLE);
  request.env.TEAM_ID = parseInt(request.env.TEAM_ID);
  request.env.YEAR = parseInt(request.env.YEAR);

  return await getSummaryData(request.env, true);
}

//Tiltify API Header Info
function getTiltifyHeader(env) {
  return {
    "Authorization": "Bearer " + env.TILTIFY_API_TOKEN,
    "Content-Type": "application/json"
  };
}

function group(arr, chunkSize, maxLength) {
  return Array.from({
    length: maxLength
  }, () => arr.splice(0, chunkSize));
}

export async function onRequest(context) {
  if (context.request.method === "GET" || context.request.method == "HEAD") {
    return await handleRequest(context);
  }

  return new Response(null,  {
    status: 204,
    headers: {
      "content-type": "application/json;charset=UTF-8",
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Allow': 'GET, HEAD, OPTIONS'
    }
  });
}

