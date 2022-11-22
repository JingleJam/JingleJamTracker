
  const maxSim = 6;                             //Maximum number of simultaneous fetches
  
  //End of 2020 dollar amount = 2827226.00
  //End of 2021 dollar amount = 6571211.42
  
  async function getSummaryData(env, getAll) {
    let tiltifyHeader = {
      headers: getTiltifyHeader(env),
    };

    var requests = [
      fetch("https://tiltify.com/api/v3/teams/" + env.TEAM_ID, tiltifyHeader),                   //Only used for getting dollar amount
      fetch("https://tiltify.com/api/v3/teams/" + env.TEAM_ID + "/campaigns", tiltifyHeader),    //Gets list of official yogscast campaigns
      fetch(env.CUSTOM_PAGE_URL)                                                                //Gets list of all campaigns, including communitiy fundraisers
    ];
  
    var retrieveDate = new Date();
  
    //Get All Responses
    const responses = await Promise.all(requests);

    var responsesArray = [];
    for(var i = 0; i < responses.length; i++)
      responsesArray.push(gatherResponse(responses[i]));
  
    const results = await Promise.all(responsesArray);
    
    //Individual Results
    var team = results[0].data;                       //Yogscast Team Data
    var campaigns = results[1].data;                  //List of Yogscast Campaigns
    var globalCampaigns = results[2].data.campaigns;  //List of all Campaigns (including fundraisers)
  
    //Combine all campaign data
    var campaignObjs = [];
    var totalRaisedPounds = 0;
    var totalFundraisedPounds = 0
  
    var slugs = [];
  
    //For all offical campaigns
    for(var i = 0; i < campaigns.length; i++){
      var campaign = campaigns[i];
      
      //If older campaign, ignore it
      if(campaign.startsAt < new Date(env.START_DATE).getTime())
        continue;
  
      //Combine offical campaign with the fundraiser campaigns
      var globalCampaign = null;
      for(var k = 0; k < globalCampaigns.length; k++){
        var temp = globalCampaigns[k];
        if(temp.slug === campaign.slug){
          globalCampaign = temp;
          continue;
        }
      }
  
      slugs.push(campaign.slug);
  
      //Create individual campaign object
      var obj = {
          id: campaign.causeId,
          slug: globalCampaign.cause.slug,
          name: globalCampaign.cause.name,
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
            pounds: globalCampaign ? parseFloat(globalCampaign.fundraising_event.amount_raised.value) : campaign.amountRaised,
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
          },
          bundles: {
            sold: 0,
            remaining: (globalCampaign ? globalCampaign.reward_quantity : 0),
            available: 0
          }
      };
      
      obj.fundraisers.pounds = parseFloat((obj.total.pounds - obj.raised.pounds).toFixed(2));
  
      totalRaisedPounds += obj.raised.pounds;
      totalFundraisedPounds += obj.fundraisers.pounds;
  
      campaignObjs.push(obj);
    }
    
    var raisedDollars = team.totalAmountRaised - env.DOLLAR_OFFSET;
    var currencyConversion = raisedDollars / totalRaisedPounds;
    var grandTotalPounds = totalFundraisedPounds + totalRaisedPounds;
  
    var currencyConversion = 1.18;
  
    try{
      if(totalRaisedPounds > .01 && raisedDollars > .01)
        currencyConversion = raisedDollars / totalRaisedPounds;
    } catch{}
  
    //Update campaigns after creation;
    for(let campaign of campaignObjs){
      campaign.raised.dollars = parseFloat((campaign.raised.pounds * currencyConversion).toFixed(2));
      campaign.fundraisers.dollars = parseFloat((campaign.fundraisers.pounds * currencyConversion).toFixed(2));
      campaign.total.dollars = parseFloat((campaign.total.pounds * currencyConversion).toFixed(2));
  
      campaign.goals.original.dollars = parseFloat((campaign.goals.original.pounds * currencyConversion).toFixed(2));
      campaign.goals.current.dollars = parseFloat((campaign.goals.current.pounds * currencyConversion).toFixed(2));
    }
  
    //Get Bundle Counts
    var totalBundlesSold = 0;
    var totalBundlesRemaining = 0;
    var totalBundlesAllocated = 0;
  
    var slugGroups = group(slugs, maxSim, Math.ceil(slugs.length/maxSim));
    var bundleResults = [];
    
    if(getAll){
  
        for(var i = 0; i < slugGroups.length; i++){
          var slugGroup = slugGroups[i];
          var bundleRequests = [];
      
          for(var j = 0; j < slugGroup.length; j++){
              var slug = slugGroup[j];
              var postMethod = {
                  body: JSON.stringify({
                    "operationName":"get_campaign_by_vanity_and_slug",
                    "variables":{
                      "vanity":"+yogscast",
                      "slug": slug
                    },
                    "query":"query get_campaign_by_vanity_and_slug($vanity: String!, $slug: String!) {\r\n  campaign(vanity: $vanity, slug: $slug) {\r\n    id\r\n    slug\r\n    rewards {\r\n      quantity\r\n      remaining\r\n    }\r\n  }\r\n}\r\n"
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
          for(var j = 0; j < bundleResponses.length; j++){
              bundleTempResults.push(gatherResponse(bundleResponses[j]));
          }
      
          var tempResults = await Promise.all(bundleTempResults);
      
          bundleResults.push.apply(bundleResults, tempResults);
        }
      
        try{
          for(var i = 0; i < bundleResults.length; i++){
            var bundle = bundleResults[i].data.campaign;
            for(var j = 0; j < campaignObjs.length; j++){
              var campaign = campaignObjs[j];
      
              if(bundle.slug === campaign.slug){
                var rewards = bundle.rewards;
                if(rewards.length > 0){
                  campaign.bundles.available = rewards[0].quantity;
                  campaign.bundles.remaining = rewards[0].remaining;
                }
                else{
                  campaign.bundles.availablee = env.DEFAULT_BUNDLES_PER_CAMPAIGN;
                  campaign.bundles.remaining = 0;
                }
                
                campaign.bundles.sold  = campaign.bundles.available - campaign.bundles.remaining;
      
                totalBundlesSold += campaign.bundles.sold;
                totalBundlesRemaining += campaign.bundles.available;
                totalBundlesAllocated += campaign.bundles.remaining;
                
                continue;
              }
            }
          }
        } catch{}
    }
  
    var numberOfDonations = totalBundlesSold + env.DONATION_DIFFERENCE;
  
    return new Response(
      JSON.stringify({
        year: env.YEAR,
        name: env.NAME,
        date: retrieveDate,
        poundsToDollars: parseFloat(currencyConversion.toFixed(6)),
        previous: {
          dollars: parseFloat(env.TOTAL_RAISED_PREVIOUS_DOLLARS.toFixed(2)),
          pounds: parseFloat(env.TOTAL_RAISED_PREVIOUS_POUNDS.toFixed(2)),
        },
        raised: {
          dollars: parseFloat(((Date.now()/100)%1000000).toFixed(2)),//parseFloat(raisedDollars.toFixed(2)),
          pounds: parseFloat(((Date.now()/120)%1000000).toFixed(2))
        },
        fundraisers: {
          dollars: parseFloat(((Date.now()/100)%1245445).toFixed(2)),//parseFloat(raisedDollars.toFixed(2)),
          pounds: parseFloat(((Date.now()/120)%1245445).toFixed(2))
        },
        total: {
          dollars: parseFloat((grandTotalPounds * currencyConversion).toFixed(2)),
          pounds: parseFloat(grandTotalPounds.toFixed(2))
        },
        bundles: {
          sold: parseInt(((Date.now()/1000)%100000)),
          remaining: totalBundlesRemaining,
          available: totalBundlesAllocated
        },
        donations:{
          count: numberOfDonations
        },
        average: {
          dollars: parseFloat(((grandTotalPounds * currencyConversion) / numberOfDonations).toFixed(2)),
          pounds: parseFloat((grandTotalPounds / numberOfDonations).toFixed(2))
        },
        campaigns: campaignObjs
      }),
      {
        headers: {
          "content-type": "application/json;charset=UTF-8"
        }
      }
    );
    /*
    return new Response(
      JSON.stringify({
        year: env.YEAR,
        name: env.NAME,
        date: retrieveDate,
        poundsToDollars: parseFloat(currencyConversion.toFixed(6)),
        previous: {
          dollars: parseFloat(env.TOTAL_RAISED_PREVIOUS_DOLLARS.toFixed(2)),
          pounds: parseFloat(env.TOTAL_RAISED_PREVIOUS_POUNDS.toFixed(2)),
        },
        raised: {
          dollars: parseFloat(raisedDollars.toFixed(2)),
          pounds: parseFloat(totalRaisedPounds.toFixed(2))
        },
        fundraisers: {
          dollars: parseFloat((totalFundraisedPounds * currencyConversion).toFixed(2)),
          pounds: parseFloat(totalFundraisedPounds.toFixed(2))
        },
        total: {
          dollars: parseFloat((grandTotalPounds * currencyConversion).toFixed(2)),
          pounds: parseFloat(grandTotalPounds.toFixed(2))
        },
        bundles: {
          sold: totalBundlesSold,
          remaining: totalBundlesRemaining,
          available: env.KEYS_AVAILABLE,
          allocated: totalBundlesAllocated
        },
        donations:{
          count: numberOfDonations
        },
        average: {
          dollars: parseFloat(((grandTotalPounds * currencyConversion) / numberOfDonations).toFixed(2)),
          pounds: parseFloat((grandTotalPounds / numberOfDonations).toFixed(2))
        },
        campaigns: campaignObjs
      }),
      {
        headers: {
          "content-type": "application/json;charset=UTF-8"
        }
      }
    );
    */
  }
  
  //Handle Requests
  
  async function handleRequest(request) {
    request.env.DEFAULT_BUNDLES_PER_CAMPAIGN = parseInt(request.env.DEFAULT_BUNDLES_PER_CAMPAIGN);
    request.env.DOLLAR_OFFSET = parseFloat(request.env.DOLLAR_OFFSET);
    request.env.DONATION_DIFFERENCE = parseInt(request.env.DONATION_DIFFERENCE);
    request.env.KEYS_AVAILABLE = parseInt(request.env.KEYS_AVAILABLE);
    request.env.TEAM_ID = parseInt(request.env.TEAM_ID);
    request.env.TOTAL_RAISED_PREVIOUS_DOLLARS = parseFloat(request.env.TOTAL_RAISED_PREVIOUS_DOLLARS);
    request.env.TOTAL_RAISED_PREVIOUS_POUNDS = parseFloat(request.env.TOTAL_RAISED_PREVIOUS_POUNDS);
    request.env.YEAR = parseInt(request.env.YEAR);

      return await getSummaryData(request.env, true);
  }
  
  //Tiltify API Header Info
  function getTiltifyHeader(env){
    return {
      "Authorization": "Bearer " + env.TILTIFY_API_TOKEN,
      "Content-Type": "application/json" 
    };
  }
  
  //Helpder Functions
  async function gatherResponse(response) {
    const { headers } = response;
    const contentType = headers.get("content-type") || "";
  
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    else {
      return response.text();
    }
  }
  
  function group(arr, chunkSize, maxLength) {
    return Array.from({length: maxLength}, () => arr.splice(0,chunkSize));
  }

  export async function onRequest(context) {
    return await handleRequest(context);
  }