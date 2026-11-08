import { YogscastDonationData } from "tiltify-cache/types/yogscast/YogscastDonationData";

/*
    Gets the data from the Yogscast API endpoint

    Used for:
        - Getting the donation count
*/
export async function get(): Promise<YogscastDonationData> {
    const response = await fetch('https://jinglejam.yogscast.com/api/total');
    // Outside the event it can be down, answering with an HTML error page
    if (!response.ok) {
        throw new Error(`Yogscast API returned ${response.status}`);
    }
    return await response.json();
}
