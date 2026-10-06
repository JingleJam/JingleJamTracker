import { getLatestData } from "tiltify-cache/api";
import { getDemoMode } from "tiltify-cache/demo/clock";
import { DemoSource } from "tiltify-cache/demo/demoSource";
import { FactDetailsService } from "tiltify-cache/services/factDetails";
import { ApiResponse } from "tiltify-cache/types/ApiResponse";
import { DataSource } from "tiltify-cache/types/DataSource";
import { Env } from "tiltify-cache/types/env";
import { FactDetails } from "tiltify-cache/types/FactDetails";

// The live data from Tiltify and the Yogscast API
export class TiltifySource implements DataSource {
    readonly demo = false;
    private env: Env;
    private factDetails = new FactDetailsService();

    constructor(env: Env) {
        this.env = env;
    }

    getLatestData(): Promise<ApiResponse> {
        return getLatestData(this.env);
    }

    getFactDetails(id: string): Promise<FactDetails> {
        return this.factDetails.get(id);
    }
}

// Generated demo data when DEMO_MODE is set, otherwise Tiltify
export function createDataSource(env: Env): DataSource {
    const mode = getDemoMode(env);
    return mode ? new DemoSource(env, mode) : new TiltifySource(env);
}
