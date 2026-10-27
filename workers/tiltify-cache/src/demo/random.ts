// Seeded random numbers, so the demo generates the same fundraisers on every refresh and in every Durable Object instance

// Numbers in [0, 1), the same sequence for the same seed (mulberry32)
export function seededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// A number in [0, 1) that is always the same for the same seed and key
export function hashRandom(seed: number, key: number): number {
    return seededRandom(seed ^ Math.imul(key + 1, 0x9E3779B1))();
}

export function between(random: () => number, min: number, max: number): number {
    return min + random() * (max - min);
}

export function integer(random: () => number, min: number, max: number): number {
    return Math.floor(between(random, min, max + 1));
}

export function chance(random: () => number, probability: number): boolean {
    return random() < probability;
}

export function pick<T>(random: () => number, items: readonly T[]): T {
    return items[Math.floor(random() * items.length)];
}

// A random UUID, the same format as Tiltify's ids
export function uuid(random: () => number): string {
    const hex = Array.from({ length: 32 }, () => Math.floor(random() * 16).toString(16)).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Round to a tidy amount like 250, 1,000 or 25,000, as people pick for goals and pledges
export function niceAmount(value: number): number {
    if (value <= 0) {
        return 0;
    }
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const step = [1, 2, 2.5, 5, 10].find(step => value <= step * magnitude * 1.25) || 10;
    return step * magnitude;
}
