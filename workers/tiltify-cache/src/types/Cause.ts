export interface Cause {
    id: string;
    legacyId?: string | undefined;
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