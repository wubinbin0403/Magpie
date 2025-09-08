/**
 * Tests for Storage Manager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageManager } from '../shared/storage';
import { DEFAULT_CONFIG, StorageKeys } from '../shared/types';

describe('StorageManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return default config when storage is empty', async () => {
      chrome.storage.sync.get = vi.fn().mockResolvedValue({});
      
      const config = await StorageManager.getConfig();
      
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should merge stored values with defaults', async () => {
      const storedData = {
        [StorageKeys.API_TOKEN]: 'test-token',
        [StorageKeys.SERVER_URL]: 'https://test.com'
      };
      chrome.storage.sync.get = vi.fn().mockResolvedValue(storedData);
      
      const config = await StorageManager.getConfig();
      
      expect(config.apiToken).toBe('test-token');
      expect(config.serverUrl).toBe('https://test.com');
      expect(config.defaultCategory).toBe(DEFAULT_CONFIG.defaultCategory);
    });

    it('should handle storage errors gracefully', async () => {
      chrome.storage.sync.get = vi.fn().mockRejectedValue(new Error('Storage error'));
      
      const config = await StorageManager.getConfig();
      
      expect(config).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('setConfig', () => {
    it('should save partial config to storage', async () => {
      chrome.storage.sync.set = vi.fn().mockResolvedValue(undefined);
      
      await StorageManager.setConfig({
        apiToken: 'new-token',
        serverUrl: 'https://new-server.com'
      });
      
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        [StorageKeys.API_TOKEN]: 'new-token',
        [StorageKeys.SERVER_URL]: 'https://new-server.com'
      });
    });

    it('should not save undefined values', async () => {
      chrome.storage.sync.set = vi.fn().mockResolvedValue(undefined);
      
      await StorageManager.setConfig({
        apiToken: 'token',
        serverUrl: undefined
      });
      
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        [StorageKeys.API_TOKEN]: 'token'
      });
    });
  });

  describe('getApiToken', () => {
    it('should return stored token', async () => {
      chrome.storage.sync.get = vi.fn().mockResolvedValue({
        [StorageKeys.API_TOKEN]: 'stored-token'
      });
      
      const token = await StorageManager.getApiToken();
      
      expect(token).toBe('stored-token');
    });

    it('should return null when no token is stored', async () => {
      chrome.storage.sync.get = vi.fn().mockResolvedValue({});
      
      const token = await StorageManager.getApiToken();
      
      expect(token).toBeNull();
    });
  });

  describe('isConfigured', () => {
    it('should return true when API token exists', async () => {
      chrome.storage.sync.get = vi.fn().mockResolvedValue({
        [StorageKeys.API_TOKEN]: 'some-token'
      });
      
      const configured = await StorageManager.isConfigured();
      
      expect(configured).toBe(true);
    });

    it('should return false when no API token', async () => {
      chrome.storage.sync.get = vi.fn().mockResolvedValue({});
      
      const configured = await StorageManager.isConfigured();
      
      expect(configured).toBe(false);
    });

    it('should return false when API token is empty string', async () => {
      chrome.storage.sync.get = vi.fn().mockResolvedValue({
        [StorageKeys.API_TOKEN]: ''
      });
      
      const configured = await StorageManager.isConfigured();
      
      expect(configured).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('should clear all storage', async () => {
      chrome.storage.sync.clear = vi.fn().mockResolvedValue(undefined);
      
      await StorageManager.clearAll();
      
      expect(chrome.storage.sync.clear).toHaveBeenCalled();
    });
  });

  describe('getStorageInfo', () => {
    it('should return storage usage information', async () => {
      chrome.storage.sync.getBytesInUse = vi.fn((keys, callback) => {
        callback(1024);
      });
      
      const info = await StorageManager.getStorageInfo();
      
      expect(info.used).toBe(1024);
      expect(info.quota).toBe(102400);
    });
  });
});