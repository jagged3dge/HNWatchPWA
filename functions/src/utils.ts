export type HnItem = {
  id?: number;
  title?: string;
  url?: string;
  by?: string;
  score?: number;
  time?: number;
};

export function isNewWithinLastHour(timestampSeconds: number, nowMs = Date.now()): boolean {
  const oneHourAgo = Math.floor(nowMs / 1000) - 60 * 60;
  return timestampSeconds >= oneHourAgo;
}

export function hnItemToUrl(item: HnItem): string {
  if (item.url) return item.url;
  if (typeof item.id === 'number') {
    return `https://news.ycombinator.com/item?id=${item.id}`;
  }
  return 'https://news.ycombinator.com';
}
