/**
 * Storage management module for the Chrome Extension
 * Handles all interactions with chrome.storage API
 */

import { 
  StorageKeys, 
  ExtensionConfig, 
  UserPreferences, 
  DEFAULT_CONFIG, 
  DEFAULT_PREFERENCES 
} from './types';

export class StorageManager {
  /**
   * Get complete extension configuration
   */
  static async getConfig(): Promise<ExtensionConfig> {
    try {
      const result = await chrome.storage.sync.get([
        StorageKeys.API_TOKEN,
        StorageKeys.SERVER_URL,
        StorageKeys.DEFAULT_CATEGORY,
        StorageKeys.DEFAULT_TAGS,
        StorageKeys.AUTO_PUBLISH
      ]);

      return {
        apiToken: result[StorageKeys.API_TOKEN] || DEFAULT_CONFIG.apiToken,
        serverUrl: result[StorageKeys.SERVER_URL] || DEFAULT_CONFIG.serverUrl,
        defaultCategory: result[StorageKeys.DEFAULT_CATEGORY] || DEFAULT_CONFIG.defaultCategory,
        defaultTags: result[StorageKeys.DEFAULT_TAGS] || DEFAULT_CONFIG.defaultTags,
        autoPublish: result[StorageKeys.AUTO_PUBLISH] ?? DEFAULT_CONFIG.autoPublish
      };
    } catch (error) {
      console.error('Failed to get config from storage:', error);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Save complete extension configuration
   */
  static async setConfig(config: Partial<ExtensionConfig>): Promise<void> {
    try {
      const dataToSave: Record<string, any> = {};
      
      if (config.apiToken !== undefined) {
        dataToSave[StorageKeys.API_TOKEN] = config.apiToken;
      }
      if (config.serverUrl !== undefined) {
        dataToSave[StorageKeys.SERVER_URL] = config.serverUrl;
      }
      if (config.defaultCategory !== undefined) {
        dataToSave[StorageKeys.DEFAULT_CATEGORY] = config.defaultCategory;
      }
      if (config.defaultTags !== undefined) {
        dataToSave[StorageKeys.DEFAULT_TAGS] = config.defaultTags;
      }
      if (config.autoPublish !== undefined) {
        dataToSave[StorageKeys.AUTO_PUBLISH] = config.autoPublish;
      }

      await chrome.storage.sync.set(dataToSave);
    } catch (error) {
      console.error('Failed to save config to storage:', error);
      throw error;
    }
  }

  /**
   * Get API token
   */
  static async getApiToken(): Promise<string | null> {
    try {
      const result = await chrome.storage.sync.get(StorageKeys.API_TOKEN);
      return result[StorageKeys.API_TOKEN] || null;
    } catch (error) {
      console.error('Failed to get API token:', error);
      return null;
    }
  }

  /**
   * Set API token
   */
  static async setApiToken(token: string | null): Promise<void> {
    try {
      await chrome.storage.sync.set({ [StorageKeys.API_TOKEN]: token });
    } catch (error) {
      console.error('Failed to save API token:', error);
      throw error;
    }
  }

  /**
   * Get server URL
   */
  static async getServerUrl(): Promise<string> {
    try {
      const result = await chrome.storage.sync.get(StorageKeys.SERVER_URL);
      return result[StorageKeys.SERVER_URL] || DEFAULT_CONFIG.serverUrl;
    } catch (error) {
      console.error('Failed to get server URL:', error);
      return DEFAULT_CONFIG.serverUrl;
    }
  }

  /**
   * Set server URL
   */
  static async setServerUrl(url: string): Promise<void> {
    try {
      await chrome.storage.sync.set({ [StorageKeys.SERVER_URL]: url });
    } catch (error) {
      console.error('Failed to save server URL:', error);
      throw error;
    }
  }

  /**
   * Get user preferences
   */
  static async getUserPreferences(): Promise<UserPreferences> {
    try {
      const result = await chrome.storage.sync.get(StorageKeys.USER_PREFERENCES);
      return result[StorageKeys.USER_PREFERENCES] || DEFAULT_PREFERENCES;
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      return DEFAULT_PREFERENCES;
    }
  }

  /**
   * Set user preferences
   */
  static async setUserPreferences(preferences: Partial<UserPreferences>): Promise<void> {
    try {
      const current = await this.getUserPreferences();
      const updated = { ...current, ...preferences };
      await chrome.storage.sync.set({ [StorageKeys.USER_PREFERENCES]: updated });
    } catch (error) {
      console.error('Failed to save user preferences:', error);
      throw error;
    }
  }

  /**
   * Clear all stored data
   */
  static async clearAll(): Promise<void> {
    try {
      await chrome.storage.sync.clear();
      console.log('All storage data cleared');
    } catch (error) {
      console.error('Failed to clear storage:', error);
      throw error;
    }
  }

  /**
   * Check if extension is configured (has API token)
   */
  static async isConfigured(): Promise<boolean> {
    const token = await this.getApiToken();
    return token !== null && token.length > 0;
  }

  /**
   * Listen for storage changes
   */
  static onChanged(callback: (changes: chrome.storage.StorageChange) => void): void {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync') {
        callback(changes);
      }
    });
  }

  /**
   * Get storage usage info
   */
  static async getStorageInfo(): Promise<{ used: number; quota: number }> {
    return new Promise((resolve) => {
      chrome.storage.sync.getBytesInUse(null, (bytesInUse) => {
        // Chrome sync storage quota is 100KB total, 8KB per item
        const quota = chrome.storage.sync.QUOTA_BYTES || 102400; // 100KB
        resolve({
          used: bytesInUse,
          quota: quota
        });
      });
    });
  }
}

// Export convenience functions for common operations
export const getConfig = StorageManager.getConfig.bind(StorageManager);
export const setConfig = StorageManager.setConfig.bind(StorageManager);
export const getApiToken = StorageManager.getApiToken.bind(StorageManager);
export const setApiToken = StorageManager.setApiToken.bind(StorageManager);
export const getServerUrl = StorageManager.getServerUrl.bind(StorageManager);
export const setServerUrl = StorageManager.setServerUrl.bind(StorageManager);
export const isConfigured = StorageManager.isConfigured.bind(StorageManager);