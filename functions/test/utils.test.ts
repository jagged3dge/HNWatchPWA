import { describe, it, expect, beforeEach } from '@jest/globals';
import { filterRecentItems, hnItemToUrl, isNewWithinLastHour, type HnItem } from '../src/utils.js';

describe('Backend Utility Functions', () => {
  describe('isNewWithinLastHour', () => {
    let now: number;

    beforeEach(() => {
      now = Math.floor(Date.now() / 1000);
    });

    it('returns true for story from 30 minutes ago', () => {
      const timestamp = now - 30 * 60;
      expect(isNewWithinLastHour(timestamp)).toBe(true);
    });

    it('returns true for story from 59 minutes ago', () => {
      const timestamp = now - 59 * 60;
      expect(isNewWithinLastHour(timestamp)).toBe(true);
    });

    it('returns true for current time', () => {
      expect(isNewWithinLastHour(now)).toBe(true);
    });

    it('returns false for story from 61 minutes ago', () => {
      const timestamp = now - 61 * 60;
      expect(isNewWithinLastHour(timestamp)).toBe(false);
    });

    it('returns false for story from 2 hours ago', () => {
      const timestamp = now - 2 * 60 * 60;
      expect(isNewWithinLastHour(timestamp)).toBe(false);
    });

    it('returns false for story from a day ago', () => {
      const timestamp = now - 24 * 60 * 60;
      expect(isNewWithinLastHour(timestamp)).toBe(false);
    });
  });

  describe('hnItemToUrl', () => {
    it('returns the item URL if provided', () => {
      const item: HnItem = {
        id: 123,
        url: 'https://example.com/article',
      };
      expect(hnItemToUrl(item)).toBe('https://example.com/article');
    });

    it('returns a comments link if no URL but has ID', () => {
      const item: HnItem = {
        id: 456,
        title: 'Ask HN: Something',
      };
      expect(hnItemToUrl(item)).toBe('https://news.ycombinator.com/item?id=456');
    });

    it('returns HN homepage if no URL and no ID', () => {
      const item: HnItem = {};
      expect(hnItemToUrl(item)).toBe('https://news.ycombinator.com');
    });
  });

  describe('filterRecentItems', () => {
    let now: number;

    beforeEach(() => {
      now = Math.floor(Date.now() / 1000);
    });

    it('includes recent stories with titles', () => {
      const items: HnItem[] = [
        {
          id: 1,
          title: 'Recent story',
          time: now - 30 * 60,
          by: 'user',
          score: 100,
        },
      ];
      expect(filterRecentItems(items)).toHaveLength(1);
    });

    it('excludes stories older than 1 hour', () => {
      const items: HnItem[] = [
        {
          id: 1,
          title: 'Old story',
          time: now - 2 * 60 * 60,
          by: 'user',
          score: 100,
        },
      ];
      expect(filterRecentItems(items)).toHaveLength(0);
    });

    it('excludes deleted items', () => {
      const items: HnItem[] = [
        {
          id: 1,
          title: 'Deleted story',
          time: now - 30 * 60,
          by: 'user',
          deleted: true,
        },
      ];
      expect(filterRecentItems(items)).toHaveLength(0);
    });

    it('excludes dead items', () => {
      const items: HnItem[] = [
        {
          id: 1,
          title: 'Dead story',
          time: now - 30 * 60,
          by: 'user',
          dead: true,
        },
      ];
      expect(filterRecentItems(items)).toHaveLength(0);
    });

    it('excludes items without title', () => {
      const items: HnItem[] = [
        {
          id: 1,
          time: now - 30 * 60,
          by: 'user',
        },
      ];
      expect(filterRecentItems(items)).toHaveLength(0);
    });

    it('excludes items without time', () => {
      const items: HnItem[] = [
        {
          id: 1,
          title: 'Story without time',
          by: 'user',
        },
      ];
      expect(filterRecentItems(items)).toHaveLength(0);
    });

    it('filters mixed batch correctly', () => {
      const items: HnItem[] = [
        {
          id: 1,
          title: 'Recent story',
          time: now - 30 * 60,
          by: 'user',
          score: 100,
        },
        {
          id: 2,
          title: 'Old story',
          time: now - 2 * 60 * 60,
          by: 'user',
          score: 50,
        },
        {
          id: 3,
          title: 'Deleted story',
          time: now - 30 * 60,
          by: 'user',
          deleted: true,
        },
        {
          id: 4,
          title: 'Another recent',
          time: now - 15 * 60,
          by: 'user',
          score: 80,
        },
      ];
      const filtered = filterRecentItems(items);
      expect(filtered).toHaveLength(2);
      expect(filtered[0]?.title).toBe('Recent story');
      expect(filtered[1]?.title).toBe('Another recent');
    });
  });
});
