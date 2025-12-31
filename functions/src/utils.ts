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
