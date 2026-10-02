import { Currency } from "./TiltifyTemplateFact";

export interface TiltifyDonationsResponse {
    data: {
        fact: TiltifyDonations | null;
    } | null;
}

export interface TiltifyDonations {
    __typename: "Fact";
    id: string;
    donations: {
        __typename: "DonationConnection";
        pageInfo: {
            startCursor: string | null;
            endCursor: string | null;
            hasNextPage: boolean;
            hasPreviousPage: boolean;
        };
        edges: {
            __typename: "DonationEdge";
            cursor: string;
            node: Donation;
        }[];
    } | null;
}

export interface Donation {
    __typename: "Donation";
    id: string;
    donorName: string;
    donorComment: string | null;
    dedication: {
        name: string;
        label: string;
    } | null;
    amount: Currency;
    matchCount: number;
    isMatch: boolean;
    incentives: {
        id: string;
        type: string;
    }[];
}
