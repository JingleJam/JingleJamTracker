import { describe, expect, it } from "vitest";
import { searchCampaigns } from "tiltify-cache/utils/search";
import { Campaign } from "tiltify-cache/types/Campaign";

let nextId = 0;

// Build a campaign, sorted lists are built by passing campaigns highest raised first
function campaign(name: string, userName: string, teamName: string | null = null, raised = 0): Campaign {
    const id = `campaign-${nextId++}`;
    return {
        id,
        slug: id,
        name,
        description: "",
        url: "",
        causeId: null,
        startTime: null,
        raised,
        goal: 0,
        live: false,
        donationMatchMultiplier: 1,
        type: "campaign",
        team: teamName ? { name: teamName, slug: "", avatar: "", url: "" } : null,
        teamEventId: null,
        user: { name: userName, slug: "", avatar: "", url: "" },
    };
}

function names(results: Campaign[]): string[] {
    return results.map(result => result.name);
}

describe("searchCampaigns", () => {
    const yogscast = campaign("Jingle Jam 2026", "yogscast", null, 1000);
    const lewis = campaign("Lewis's Christmas Stream", "LewisBrindley", null, 500);
    const coreKeeper = campaign("Core Keeper Survive-A-Thon", "Laimu", "Core Crew", 300);
    const cafe = campaign("Café Stream for CALM", "Barista", null, 200);
    const lewisFan = campaign("Stream for Lewis", "fan", null, 100);
    const all = [yogscast, lewis, coreKeeper, cafe, lewisFan];

    it("returns every campaign for an empty search", () => {
        expect(searchCampaigns(all, "   ")).toEqual(all);
    });

    it("matches the campaign name, the user name and the team name", () => {
        expect(names(searchCampaigns(all, "jingle"))).toEqual(["Jingle Jam 2026"]);
        expect(names(searchCampaigns(all, "laimu"))).toEqual(["Core Keeper Survive-A-Thon"]);
        expect(names(searchCampaigns(all, "crew"))).toEqual(["Core Keeper Survive-A-Thon"]);
    });

    it("isn't case or accent sensitive and ignores punctuation", () => {
        expect(names(searchCampaigns(all, "CAFE"))).toEqual(["Café Stream for CALM"]);
        expect(names(searchCampaigns(all, "survive a thon"))).toEqual(["Core Keeper Survive-A-Thon"]);
    });

    it("tolerates small typos", () => {
        expect(names(searchCampaigns(all, "jingel"))).toEqual(["Jingle Jam 2026"]);
        expect(names(searchCampaigns(all, "keeepr"))).toEqual(["Core Keeper Survive-A-Thon"]);
        expect(names(searchCampaigns(all, "christmsa"))).toEqual(["Lewis's Christmas Stream"]);
    });

    it("requires short words to be spelled correctly", () => {
        expect(searchCampaigns(all, "jma")).toEqual([]);
    });

    it("tolerates typos inside a name that is run together, for longer words", () => {
        const spiffing = campaign("Spiff Vs ChariTea", "TheSpiffingBrit");

        expect(names(searchCampaigns([spiffing], "spifing"))).toEqual(["Spiff Vs ChariTea"]);
        expect(names(searchCampaigns([spiffing], "brti"))).toEqual([]);
    });

    it("matches a partly typed word, with or without a typo", () => {
        expect(names(searchCampaigns(all, "christ"))).toEqual(["Lewis's Christmas Stream"]);
        expect(names(searchCampaigns(all, "chirst"))).toEqual(["Lewis's Christmas Stream"]);
    });

    it("matches a name typed without spaces", () => {
        expect(names(searchCampaigns(all, "corekeeper"))).toEqual(["Core Keeper Survive-A-Thon"]);
    });

    it("requires every word to match", () => {
        expect(names(searchCampaigns(all, "core stream"))).toEqual([]);
        expect(names(searchCampaigns(all, "core thon"))).toEqual(["Core Keeper Survive-A-Thon"]);
    });

    it("ranks better matches first, then by amount raised", () => {
        // A name starting with the search beats the same word later in a name, even for a campaign that raised less
        expect(names(searchCampaigns(all, "stream"))).toEqual(["Stream for Lewis", "Lewis's Christmas Stream", "Café Stream for CALM"]);
        expect(names(searchCampaigns(all, "lewis"))).toEqual(["Lewis's Christmas Stream", "Stream for Lewis"]);

        // Equal matches stay in amount raised order
        expect(names(searchCampaigns(all, "for"))).toEqual(["Café Stream for CALM", "Stream for Lewis"]);
    });

    it("finds nothing for unrelated text", () => {
        expect(searchCampaigns(all, "minecraft")).toEqual([]);
    });
});
