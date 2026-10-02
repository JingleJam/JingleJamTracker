import { Currency, Image } from "./TiltifyTemplateFact";

export interface TiltifyLeaderboardsResponse {
    data: {
        fact: TiltifyLeaderboards | null;
    } | null;
}

export interface TiltifyLeaderboards {
    __typename: "Fact";
    id: string;
    donorLeaderboard: Leaderboard | null;
    userLeaderboard: Leaderboard | null;
    teamLeaderboard: Leaderboard | null;
}

export interface Leaderboard {
    __typename: "Leaderboard";
    id: string;
    entries: {
        __typename: "LeaderboardEntryConnection";
        edges: {
            __typename: "LeaderboardEntryEdge";
            node: LeaderboardEntry;
        }[];
    };
}

export interface LeaderboardEntry {
    __typename: "LeaderboardEntry";
    id: string;
    name: string;
    heat: number | null;
    url: string | null;
    amount: Currency;
    avatar: Image | null;
}
