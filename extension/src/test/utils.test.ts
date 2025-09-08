/**
 * Tests for utility functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractDomain,
  isValidUrl,
  getPageTitle,
  parseTags,
  formatTags,
  sanitizeString,
  formatBytes
} from '../shared/utils';

describe('Utility Functions', () => {
  describe('extractDomain', () => {
    it('should extract domain from valid URL', () => {
      expect(extractDomain('https://example.com/path')).toBe('example.com');
      expect(extractDomain('http://subdomain.example.org')).toBe('subdomain.example.org');
    });

    it('should return empty string for invalid URL', () => {
      expect(extractDomain('not-a-url')).toBe('');
      expect(extractDomain('')).toBe('');
    });
  });

  describe('isValidUrl', () => {
    it('should return true for valid URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('https://test.example.com/path?query=1')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
      // Note: 'javascript:' is actually a valid URL protocol, so we focus on clearly invalid ones
      expect(isValidUrl('://invalid')).toBe(false);
    });
  });

  describe('getPageTitle', () => {
    it('should return tab title when available', () => {
      const tab = { title: 'Test Page', url: 'https://example.com' } as chrome.tabs.Tab;
      expect(getPageTitle(tab)).toBe('Test Page');
    });

    it('should extract title from URL when tab title is not useful', () => {
      const tab = { title: 'New Tab', url: 'https://example.com/about-us' } as chrome.tabs.Tab;
      expect(getPageTitle(tab)).toBe('about us');
    });

    it('should return hostname when path extraction fails', () => {
      const tab = { title: 'chrome://newtab/', url: 'https://example.com' } as chrome.tabs.Tab;
      expect(getPageTitle(tab)).toBe('example.com');
    });

    it('should return fallback for invalid scenarios', () => {
      const tab = { title: undefined, url: undefined } as chrome.tabs.Tab;
      expect(getPageTitle(tab)).toBe('Unknown Page');
    });
  });

  describe('parseTags', () => {
    it('should parse comma-separated tags', () => {
      expect(parseTags('tag1, tag2, tag3')).toEqual(['tag1', 'tag2', 'tag3']);
      expect(parseTags('javascript,typescript,react')).toEqual(['javascript', 'typescript', 'react']);
    });

    it('should trim whitespace and remove empty tags', () => {
      expect(parseTags(' tag1 , , tag2 , ')).toEqual(['tag1', 'tag2']);
    });

    it('should limit to 5 tags', () => {
      expect(parseTags('a,b,c,d,e,f,g')).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('should handle invalid input', () => {
      expect(parseTags('')).toEqual([]);
      expect(parseTags(null as any)).toEqual([]);
      expect(parseTags(undefined as any)).toEqual([]);
    });
  });

  describe('formatTags', () => {
    it('should join tags with comma and space', () => {
      expect(formatTags(['tag1', 'tag2', 'tag3'])).toBe('tag1, tag2, tag3');
    });

    it('should filter out empty tags', () => {
      expect(formatTags(['tag1', '', 'tag2', ' '])).toBe('tag1, tag2');
    });

    it('should handle empty array', () => {
      expect(formatTags([])).toBe('');
    });
  });

  describe('sanitizeString', () => {
    it('should remove HTML-like characters', () => {
      expect(sanitizeString('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
      expect(sanitizeString('Hello <b>world</b>')).toBe('Hello bworld/b');
    });

    it('should normalize whitespace', () => {
      expect(sanitizeString('  hello   world  ')).toBe('hello world');
      expect(sanitizeString('hello\nworld\ttab')).toBe('hello world tab');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should handle decimal precision', () => {
      expect(formatBytes(1536, 1)).toBe('1.5 KB');
      expect(formatBytes(1536, 0)).toBe('2 KB');
    });
  });
});