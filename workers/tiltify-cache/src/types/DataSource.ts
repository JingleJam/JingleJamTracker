import { ApiResponse } from "./ApiResponse";
import { FactDetails } from "./FactDetails";

// Where the TiltifyData Durable Object gets its data from: Tiltify, or generated demo data (DEMO_MODE)
export interface DataSource {
    readonly demo: boolean;     // Demo data is never persisted or restored, always refreshes, and skips the checks for failed Tiltify fetches
    getLatestData(): Promise<ApiResponse>;
    getFactDetails(id: string): Promise<FactDetails>;
}
