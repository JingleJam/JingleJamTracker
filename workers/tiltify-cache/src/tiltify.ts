import { BaseTiltifyResponse } from "./types/tiltify/BaseResponse";
import { TiltifyUserCampaign } from "./types/tiltify/TiltifyUserCampaign";
import { TiltifyFundraisingEvent } from "./types/tiltify/TiltifyFundraisingEvent";
import { FundraisingEventCampaignsData } from "./types/tiltify/TiltifyFundraisingEventCampaign";
import { YogscastDonationData } from "./types/yogscast/YogscastDonationData";

const TILTIFY_API_ENDPOINT = "https://api.tiltify.com/";
const TILTIFY_API_OPTIONS: RequestInit = {
    method: "POST",
    headers: {
        "content-type": "application/json",
    },
};

/*
    Gets campaign information for a specific user and campaign

    Used for:
        - Yogscast Campaign Pound Amount
        - Yogscast Campaign Dollar Amount
        - Average Conversion Rate
        - Backup Collections Data
*/
export async function getCampaign(userSlug: string, campaignSlug: string): Promise<TiltifyUserCampaign | null> {
    const request: RequestInit = {
        body: JSON.stringify({
            "operationName": "get_campaign_by_vanity_and_slug",
            "variables": {
                "vanity": "@" + userSlug,
                "slug": campaignSlug
            },
            "query": "query get_campaign_by_vanity_and_slug($vanity: String!, $slug: String!) { campaign(vanity: $vanity, slug: $slug) { publicId legacyCampaignId name slug status originalGoal { value } region { name } totalAmountRaised { value } goal { value } user { id username slug totalAmountRaised { value } } cause { id name slug } fundraisingEvent { publicId legacyFundraisingEventId name slug } livestream { channel type } rewards { quantity remaining amount { value } quantity remaining } } }"
        }),
        ...TILTIFY_API_OPTIONS
    };

    const response = await fetch(TILTIFY_API_ENDPOINT, request);
    return ((await response.json()) as BaseTiltifyResponse<{ campaign: TiltifyUserCampaign}>)?.data?.campaign || null;
}

/*
    Gets all event data for a related cause and fundraiser

    Used for:
        - Jingle Jam Pound Amount
        - Collections Data
*/
export async function getEvent(causeSlug: string, fundraiserSlug: string): Promise<TiltifyFundraisingEvent | null> {
    const request: RequestInit = {
        body: JSON.stringify({
            "operationName": "get_cause_and_fe_by_slug",
            "variables": {
                "causeSlug": causeSlug,
                "feSlug": fundraiserSlug
            },
            "query": "query get_cause_and_fe_by_slug($feSlug: String!, $causeSlug: String!) { fundraisingEvent(slug: $feSlug, causeSlug: $causeSlug) { amountRaised { currency value } rewards { quantity remaining } totalAmountRaised { value } } }"
        }),
        ...TILTIFY_API_OPTIONS
    };

    const response = await fetch(TILTIFY_API_ENDPOINT, request);
    return ((await response.json()) as BaseTiltifyResponse<{ fundraisingEvent: TiltifyFundraisingEvent}>)?.data?.fundraisingEvent || null;
}

/*
    Gets the list of all campaigns for a given fundraiser

    Used for:
        - Listing Out Campaigns
        - Calculating Raised for each Cause
*/
export async function getCampaigns(fundraiserPublicId: string, offset: number): Promise<FundraisingEventCampaignsData> {
    const request: RequestInit = {
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
        ...TILTIFY_API_OPTIONS
    };

    const response = await fetch(TILTIFY_API_ENDPOINT, request);
    return ((await response.json()) as BaseTiltifyResponse<{ fundraisingEvent: FundraisingEventCampaignsData}>)?.data?.fundraisingEvent || null;
}

/*
    Gets the data from the Yogscast API endpoint

    Used for:
        - Getting the donation count
*/
export async function getYogscastAPI(): Promise<YogscastDonationData> {
    const response = await fetch('https://jinglejam.yogscast.com/api/total');
    return await response.json();
}
