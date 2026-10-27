import { Env } from "tiltify-cache/types/env";

export const DEMO_MODES = ['starting', 'running', 'ending'] as const;
export type DemoMode = typeof DEMO_MODES[number];

export const DEMO_CLOCK_KEY = 'demo-clock'; // KV key of the demo clock, cleared by `npm run seed` so every `npm run dev` starts a new demo
const LEAD_TIME_MS = 30 * 1000; // How long after the first request the demo event starts (starting) or ends (ending)
const RUNNING_ELAPSED_MS = 3 * 24 * 60 * 60 * 1000; // How far into the event the demo is on the first request (running)
const CLOCK_TTL_MS = 10 * 1000; // How long the clock is reused before it is read from KV again, to pick up a reset

interface StoredClock {
    mode: DemoMode;
    anchor: number;     // When the demo was first requested (ms)
}

export interface DemoEvent {
    start: Date;
    end: Date;
}

// The demo mode set in DEMO_MODE, or null to use Tiltify. A value that isn't a mode is an error, so a typo never quietly calls Tiltify.
export function getDemoMode(env: Env): DemoMode | null {
    const mode = (env.DEMO_MODE || '').trim().toLowerCase();
    if (!mode) {
        return null;
    }
    if (!DEMO_MODES.includes(mode as DemoMode)) {
        throw new Error(`Invalid DEMO_MODE "${env.DEMO_MODE}". Use ${DEMO_MODES.join(', ')}, or leave it empty to use Tiltify.`);
    }
    return mode as DemoMode;
}

// The real event's length (1 Dec 17:00 to 15 Dec 08:00 UTC), so the demo's dates and graph look like the real event's
export function getEventLength(year: number): number {
    return Date.UTC(year, 11, 15, 8, 0, 0) - Date.UTC(year, 11, 1, 17, 0, 0);
}

/**
 * Demo Clock
 *
 * Sets the demo event's dates from when the demo was first requested. The first request stores that time in KV, so every
 * Durable Object instance (the API's and the graph's) shows the same event, and it survives restarts and file changes.
 * The clock starts again when DEMO_MODE changes or the KV value is cleared.
 */
export class DemoClock {
    private kv: KVNamespace;
    private mode: DemoMode;
    private eventLength: number;
    private stored: StoredClock | null = null;
    private readAt = 0;

    constructor(kv: KVNamespace, mode: DemoMode, year: number) {
        this.kv = kv;
        this.mode = mode;
        this.eventLength = getEventLength(year);
    }

    async getEvent(): Promise<DemoEvent> {
        if (!this.stored || Date.now() - this.readAt >= CLOCK_TTL_MS) {
            this.stored = await this.read();
            this.readAt = Date.now();
        }

        const anchor = this.stored.anchor;
        switch (this.mode) {
            case 'starting': {
                const start = anchor + LEAD_TIME_MS;
                return { start: new Date(start), end: new Date(start + this.eventLength) };
            }
            case 'running': {
                const start = anchor - RUNNING_ELAPSED_MS;
                return { start: new Date(start), end: new Date(start + this.eventLength) };
            }
            case 'ending': {
                const end = anchor + LEAD_TIME_MS;
                return { start: new Date(end - this.eventLength), end: new Date(end) };
            }
        }
    }

    // Read the stored clock, starting a new one if there is none or it was started for another mode
    private async read(): Promise<StoredClock> {
        let stored: StoredClock | null = null;
        try {
            stored = await this.kv.get<StoredClock>(DEMO_CLOCK_KEY, 'json');
        } catch (e) {
            console.error('Failed to read the demo clock', e);
            if (this.stored) {
                return this.stored;
            }
        }

        if (stored && stored.mode === this.mode && typeof stored.anchor === 'number') {
            return stored;
        }

        const clock: StoredClock = { mode: this.mode, anchor: Date.now() };
        await this.kv.put(DEMO_CLOCK_KEY, JSON.stringify(clock));
        console.log(`Started the demo clock (${this.mode})`);
        return clock;
    }
}
