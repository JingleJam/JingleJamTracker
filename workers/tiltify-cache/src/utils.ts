function sortByKey<T>(array: T[], key: keyof T): T[] {
  return array.sort((a, b) => {
      const x = a[key];
      const y = b[key];
      return (x < y) ? 1 : (x > y) ? -1 : 0;
  });
}

function roundAmount(val: number, decimals: number = 2): number {
  return +(Math.round(Number(val + "e+" + decimals)) + ("e-" + decimals));
}

function getRandomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Generates a URL-friendly slug from a string.
 * Converts strings like "sam_eklls & meg__h" to "sam-eklls-and-meg-h"
 * Converts "Charlie | CALM" to "charlie-or-calm"
 * 
 * @param input - The string to convert to a slug
 * @returns A URL-friendly slug string
 */
function generateSlug(input: string | null): string | null {
  if (!input) return null;
  
  return input
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')          // Replace & with " and " (with spaces)
    .replace(/\|/g, ' or ')          // Replace | with " or " (with spaces)
    .replace(/\s+/g, '-')            // Replace spaces with hyphens
    .replace(/_/g, '-')              // Replace underscores with hyphens
    .replace(/[^a-z0-9-]/g, '')      // Remove any non-alphanumeric characters except hyphens
    .replace(/-+/g, '-')             // Replace multiple consecutive hyphens with a single hyphen
    .replace(/^-+|-+$/g, '');        // Remove leading and trailing hyphens
}

export {
  roundAmount,
  sortByKey,
  getRandomFloat,
  generateSlug
};
