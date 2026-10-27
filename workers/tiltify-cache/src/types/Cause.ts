export interface Cause {
    id: string;
    slug: string;
    name: string;
    logo: string;
    borderedLogo: string;
    description: string;
    color: string;
    url: string;
    donateUrl: string;
    override?: number;
    raised: number;
    raisedDirect: number;   // The part of `raised` given to this cause specifically (summaries persisted before it was added don't have it)
    campaigns: number;
    live: number;
}