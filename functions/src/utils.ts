/**
 * Utility functions for HN Watcher backend
 */

/**
 * Hacker News API item type
 */
export type HnItem = {
  id?: number;
  type?: string;
  title?: string;
  text?: string;
  by?: string;
  score?: number;
  time?: number;
  url?: string;
  dead?: boolean;
  deleted?: boolean;
};

/**
 * Check if a HN story was published within the last hour
 */
export function isNewWithinLastHour(timestamp: number): boolean {
  const oneHourAgo = Math.floor(Date.now() / 1000) - 60 * 60;
  return timestamp >= oneHourAgo;
}

/**
 * Convert HN item to a URL
 * Returns the story's URL if it has one, otherwise returns a link to the HN comments
 */
export function hnItemToUrl(item: HnItem): string {
  if (item.url) {
    return item.url;
  }
  if (item.id) {
    return `https://news.ycombinator.com/item?id=${item.id}`;
  }
  return 'https://news.ycombinator.com';
}

/**
 * Filter HN items to those published in the last hour
 */
export function filterRecentItems(items: HnItem[]): HnItem[] {
  return items.filter((item) => {
    // Skip deleted/dead items
    if (item.deleted || item.dead) {
      return false;
    }
    // Must have a time and title
    if (!item.time || !item.title) {
      return false;
    }
    // Must be from the last hour
    return isNewWithinLastHour(item.time);
  });
}

/**
 * Retry configuration for fetch operations
 */
export type RetryConfig = {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
};

/**
 * Fetch with exponential backoff retry logic
 */
export async function fetchWithRetry(
  url: string,
  config: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },
  retries = config.maxRetries,
  delayMs = config.initialDelayMs,
): Promise<Response> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      console.warn(`Fetch failed for ${url}, retrying in ${delayMs}ms (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      const nextDelay = Math.min(
        delayMs * config.backoffMultiplier,
        config.maxDelayMs,
      );
      return fetchWithRetry(url, config, retries - 1, nextDelay);
    }
    throw error;
  }
}
