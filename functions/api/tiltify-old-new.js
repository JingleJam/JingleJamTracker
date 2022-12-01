import {
  summary,
  getTotals
} from "./data";

const maxSim = 6; //Maximum number of simultaneous fetches

//End of 2020 yogscast dollar amount = 2827226.00
//End of 2021 yogscast dollar amount = 6571211.42

async function getSummaryData(env) {
  let tiltifyHeader = {
    headers: getTiltifyHeader(env),
  };

  var requests = [
    fetch("https://tiltify.com/api/v3/teams/" + env.TEAM_ID, tiltifyHeader), //Only used for getting dollar amount and the username
    fetch("https://tiltify.com/api/v3/teams/" + env.TEAM_ID + "/campaigns", tiltifyHeader) //Gets list of official yogscast campaigns
  ];

  var retrieveDate = new Date();

  //Get All Responses
  const responses = await Promise.all(requests);

  var responsesArray = [];
  for (var i = 0; i < responses.length; i++)
    responsesArray.push(gatherResponse(responses[i]));

  const results = await Promise.all(responsesArray);

  //Individual Results
  var team = results[0].data; //Yogscast Team Data
  var campaigns = results[1].data; //List of Yogscast Campaigns
  var totals = await getEvent(env.CAUSE_SLUG, env.FUNDRAISER_SLUG); //List of Yogscast Campaigns

  //Combine all campaign data
  var campaignObjs = [];
  var yogscastPounds = 0;

  var slugs = [];

  //For all offical campaigns
  for (var i = 0; i < campaigns.length; i++) {
    var campaign = campaigns[i];

    //If older campaign, ignore it
    if (campaign.startsAt < new Date(env.START_DATE).getTime())
      continue;

    slugs.push(campaign.slug);

    //Create individual campaign object
    var obj = {
      id: campaign.causeId,
      slug: campaign.slug,
      name: null,
      currency: campaign.causeCurrency,
      campaign: {
        id: campaign.id,
        slug: campaign.slug,
        name: campaign.name,
        description: campaign.description,
        startDate: new Date(campaign.startsAt),
        endDate: new Date(campaign.endsAt)
      },
      raised: {
        dollars: 0,
        pounds: campaign.amountRaised
      },
      fundraisers: {
        dollars: 0,
        pounds: 0
      },
      total: {
        dollars: 0,
        pounds: 0,
      },
      goals: {
        original: {
          dollars: 0,
          pounds: campaign.originalFundraiserGoal
        },
        current: {
          dollars: 0,
          pounds: campaign.fundraiserGoalAmount
        }
      }
    };

    yogscastPounds += obj.raised.pounds;

    campaignObjs.push(obj);
  }

  var slugGroups = group(slugs, maxSim, Math.ceil(slugs.length / maxSim));
  var bundleResults = [];

  for (var i = 0; i < slugGroups.length; i++) {
    var slugGroup = slugGroups[i];
    var bundleRequests = [];

    for (var j = 0; j < slugGroup.length; j++) {
      var slug = slugGroup[j];
      var postMethod = {
        body: JSON.stringify({
          "operationName": "get_campaign_by_vanity_and_slug",
          "variables": {
            "vanity": "+" + team.slug,
            "slug": slug
          },
          "query": "query get_campaign_by_vanity_and_slug($vanity: String!, $slug: String!) {\r\n  campaign(vanity: $vanity, slug: $slug) {fundraisingEvent { name slug publicId amountRaised { currency value} }    slug     cause { slug name }     rewards { quantity remaining }     }\r\n}\r\n"
        }),
        method: "POST",
        headers: {
          "content-type": "application/json;charset=UTF-8",
        },
      };
      bundleRequests.push(fetch("https://api.tiltify.com/", postMethod));
    }

    var bundleResponses = await Promise.all(bundleRequests);

    var bundleTempResults = [];
    for (var j = 0; j < bundleResponses.length; j++) {
      bundleTempResults.push(gatherResponse(bundleResponses[j]));
    }

    var tempResults = await Promise.all(bundleTempResults);

    bundleResults.push.apply(bundleResults, tempResults);
  }

  try {
    for (var i = 0; i < bundleResults.length; i++) {
      var bundle = bundleResults[i].data.campaign;
      for (var j = 0; j < campaignObjs.length; j++) {
        var campaign = campaignObjs[j];

        if (bundle.slug === campaign.slug) {

          //Get Cause Info
          campaign.slug = bundle.cause.slug;
          campaign.name = bundle.cause.name;

          //Get Fundraising Info
          campaign.total.pounds = roundAmount(bundle.fundraisingEvent.amountRaised.value);
          campaign.fundraisers.pounds = roundAmount(campaign.total.pounds - campaign.raised.pounds);

          totalPounds += campaign.total.pounds;

          continue;
        }
      }
    }
  } catch (e) {
  }

  var yogscastDollars = team.totalAmountRaised - env.DOLLAR_OFFSET;
  var currencyConversion = yogscastDollars / yogscastPounds;

  var currencyConversion = 1.205;

  try {
    if (yogscastPounds > .01 && yogscastDollars > .01)
      currencyConversion = yogscastDollars / yogscastPounds;
  } catch {}


  //Update campaigns after creation;
  for (let campaign of campaignObjs) {
    campaign.goals.original.dollars = roundAmount(campaign.goals.original.pounds * currencyConversion);
    campaign.goals.current.dollars = roundAmount(campaign.goals.current.pounds * currencyConversion);

    campaign.total.dollars = roundAmount(campaign.total.pounds * currencyConversion);
    campaign.fundraisers.dollars = roundAmount(campaign.fundraisers.pounds * currencyConversion);
    campaign.raised.dollars = roundAmount(campaign.raised.pounds * currencyConversion);

  }

  let totalPounds = roundAmount(parseFloat(totals.data.fundraisingEvent.amountRaised.value));
  let totalDollars = roundAmount(totalPounds * currencyConversion);
  
  let fundraisersPounds = roundAmount(totalPounds - yogscastPounds);
  let fundraiserDollars = roundAmount(fundraisersPounds * currencyConversion);

  let totalBundlesAllocated = totals.data.fundraisingEvent.rewards[0].quantity;
  let totalBundlesRemaining = totals.data.fundraisingEvent.rewards[0].remaining;
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
        dollars: roundAmount(yogscastDollars),
        pounds: roundAmount(yogscastPounds)
      },
      fundraisers: {
        dollars: fundraiserDollars,
        pounds: fundraisersPounds
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

//Helpder Functions
async function gatherResponse(response) {
  const {
    headers
  } = response;
  const contentType = headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await response.json();
  } else {
    return await response.text();
  }
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

