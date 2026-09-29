export interface Cause {
    id: string;
    slug: string;
    name: string;
    logo: string;
    description: string;
    color: string;
    url: string;
    donateUrl: string;
    override?: number;
    raised: number;
    campaigns: number;
}