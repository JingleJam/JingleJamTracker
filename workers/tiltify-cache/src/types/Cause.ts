export interface Cause {
    id: string;
    name: string;
    logo: string;
    description: string;
    color: string;
    url: string;
    donateUrl: string;
    override?: number;
    raised: {
        yogscast: number;
        fundraisers: number;
    };
}