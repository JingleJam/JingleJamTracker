import { Campaign } from "tiltify-cache/types/Campaign";

/**
 * Typo-tolerant text search over the campaign list, used by the campaigns API path's search parameter.
 *
 * Matches the campaign name, the owner's name and the team name. Every word of the query has to match a word in
 * one of those (exactly, as the start of a word, inside a word, or with a small typo), unless the whole query
 * matches a name as a phrase. Results are ordered by how well they match, then by amount raised.
 */

// Scores for one query word against one name word, best first
const WORD_EXACT = 4;
const WORD_PREFIX = 3;
const WORD_SUBSTRING = 2;
const WORD_TYPO = 1;

// Scores for the whole query against a whole name
const PHRASE_EXACT = 10;
const PHRASE_PREFIX = 6;
const PHRASE_SUBSTRING = 4;

const MIN_SUBSTRING_LENGTH = 3; // Shorter query words only match whole words or the start of a word
const MIN_INFIX_TYPO_LENGTH = 5; // Shorter query words only allow typos in a whole word or the start of a word

interface SearchName {
    phrase: string;     // Normalised name, e.g. "lewis brindley"
    compact: string;    // Without spaces, e.g. "lewisbrindley"
    words: string[];
}

// Names are normalised once per campaign object, which is replaced on every refresh
const nameCache = new WeakMap<Campaign, SearchName[]>();

export function searchCampaigns(campaigns: Campaign[], query: string): Campaign[] {
    const phrase = normalize(query);
    const words = phrase.split(' ').filter(Boolean);
    if (words.length === 0) {
        return campaigns;
    }
    const compact = words.join('');

    const results: { campaign: Campaign; score: number }[] = [];
    for (const campaign of campaigns) {
        const score = scoreCampaign(getNames(campaign), phrase, compact, words);
        if (score > 0) {
            results.push({ campaign, score });
        }
    }

    // The sort is stable and the list is already sorted by amount raised, so equal scores stay in that order
    return results.sort((a, b) => b.score - a.score).map(result => result.campaign);
}

function scoreCampaign(names: SearchName[], phrase: string, compact: string, words: string[]): number {
    let phraseScore = 0;
    for (const name of names) {
        if (name.phrase === phrase) {
            phraseScore = Math.max(phraseScore, PHRASE_EXACT);
        } else if (name.phrase.startsWith(phrase)) {
            phraseScore = Math.max(phraseScore, PHRASE_PREFIX);
        } else if (compact.length >= MIN_SUBSTRING_LENGTH && name.compact.includes(compact)) {
            phraseScore = Math.max(phraseScore, PHRASE_SUBSTRING);
        }
    }

    // Every query word has to match somewhere, otherwise only a phrase match counts
    let wordScore = 0;
    for (const word of words) {
        let best = 0;
        for (const name of names) {
            for (const nameWord of name.words) {
                best = Math.max(best, scoreWord(word, nameWord));
                if (best === WORD_EXACT) break;
            }
            if (best === WORD_EXACT) break;
        }
        if (best === 0) {
            wordScore = 0;
            break;
        }
        wordScore += best;
    }

    return phraseScore + wordScore;
}

function scoreWord(word: string, nameWord: string): number {
    if (nameWord === word) {
        return WORD_EXACT;
    }
    if (nameWord.startsWith(word)) {
        return WORD_PREFIX;
    }
    if (word.length >= MIN_SUBSTRING_LENGTH && nameWord.includes(word)) {
        return WORD_SUBSTRING;
    }

    const maxTypos = getMaxTypos(word);
    if (maxTypos === 0) {
        return 0;
    }

    // Longer words can have typos anywhere inside a name word, since names are often run together ("thespiffingbrit")
    if (word.length >= MIN_INFIX_TYPO_LENGTH) {
        return editDistance(word, nameWord, maxTypos, true) <= maxTypos ? WORD_TYPO : 0;
    }

    // Otherwise allow typos in the whole word, or in the start of a longer word (so a partly typed word still matches)
    if (Math.abs(nameWord.length - word.length) <= maxTypos && editDistance(word, nameWord, maxTypos) <= maxTypos) {
        return WORD_TYPO;
    }
    if (nameWord.length > word.length && editDistance(word, nameWord.slice(0, word.length), maxTypos) <= maxTypos) {
        return WORD_TYPO;
    }

    return 0;
}

// Short words have to be spelled correctly, longer words can have more typos
function getMaxTypos(word: string): number {
    if (word.length < 4) return 0;
    if (word.length < 8) return 1;
    return 2;
}

// Edit distance counting insertions, deletions, substitutions and swaps of two neighbouring characters.
// With anywhere, it is the distance from a to the closest part of b (skipping the start and end of b is free).
// Stops early and returns max + 1 once the distance is known to be more than max.
function editDistance(a: string, b: string, max: number, anywhere = false): number {
    let previousPrevious: number[] = [];
    let previous = Array.from({ length: b.length + 1 }, (_, j) => anywhere ? 0 : j);

    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        let rowMin = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                current[j] = Math.min(current[j], previousPrevious[j - 2] + 1);
            }
            rowMin = Math.min(rowMin, current[j]);
        }
        if (rowMin > max) {
            return max + 1;
        }
        previousPrevious = previous;
        previous = current;
    }

    return anywhere ? Math.min(...previous) : previous[b.length];
}

function getNames(campaign: Campaign): SearchName[] {
    let names = nameCache.get(campaign);
    if (!names) {
        names = [campaign.name, campaign.user?.name, campaign.team?.name]
            .map(name => normalize(name || ''))
            .filter(Boolean)
            .map(phrase => ({ phrase, compact: phrase.replace(/ /g, ''), words: phrase.split(' ') }));
        nameCache.set(campaign, names);
    }
    return names;
}

// Lowercase, without accents, with anything that isn't a letter or number turned into a single space
function normalize(text: string): string {
    return text
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}
