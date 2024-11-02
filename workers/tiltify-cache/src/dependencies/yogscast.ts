import { YogscastDonationData } from "tiltify-cache/types/yogscast/YogscastDonationData";

/*
    Gets the data from the Yogscast API endpoint

    Used for:
        - Getting the donation count
*/
export async function get(): Promise<YogscastDonationData> {
    const response = await fetch('https://jinglejam.yogscast.com/api/total');
    return await response.json();
}
