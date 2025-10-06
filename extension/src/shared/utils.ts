/**
 * Utility functions for the Chrome Extension
 */

/**
 * Get the current active tab
 */
export async function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch (error) {
    console.error('Failed to get current tab:', error);
    return null;
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    console.error('Invalid URL:', url, error);
    return '';
  }
}

/**
 * Validate URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract title from tab or generate fallback
 */
export function getPageTitle(tab: chrome.tabs.Tab, url?: string): string {
  if (tab.title && tab.title !== 'New Tab' && !tab.title.startsWith('chrome://')) {
    return tab.title;
  }
  
  if (url || tab.url) {
    const urlToUse = url || tab.url!;
    try {
      const urlObj = new URL(urlToUse);
      // Extract meaningful title from path
      const pathParts = urlObj.pathname.split('/').filter(part => part);
      const lastPart = pathParts[pathParts.length - 1];
      
      if (lastPart && lastPart !== 'index.html') {
        return lastPart.replace(/[-_]/g, ' ').replace(/\.[^/.]+$/, '');
      }
      
      return urlObj.hostname;
    } catch {
      return '未知页面';
    }
  }
  
  return '未知页面';
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Format file size
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 字节';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['字节', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Show browser notification
 */
export function showNotification(
  title: string, 
  message: string, 
  type: 'basic' | 'image' | 'list' | 'progress' = 'basic'
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Check if notifications permission is available
      if (!chrome.notifications) {
        reject(new Error('通知 API 不可用'));
        return;
      }

      const notificationOptions: chrome.notifications.NotificationOptions = {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: title || 'Magpie 扩展',
        message: message || '操作已完成',
      };
      
      chrome.notifications.create(notificationOptions, (notificationId) => {
        if (chrome.runtime.lastError) {
          console.error('Notification error:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message || 'Notification failed'));
        } else if (notificationId) {
          resolve(notificationId);
        } else {
          reject(new Error('Failed to create notification'));
        }
      });
    } catch (error) {
      console.error('Notification exception:', error);
      reject(error);
    }
  });
}

/**
 * Sleep function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxAttempts) {
        break;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Sanitize string for safe display
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Parse tags string into array
 */
export function parseTags(tagsString: string): string[] {
  if (!tagsString || typeof tagsString !== 'string') {
    return [];
  }
  
  return tagsString
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
    .slice(0, 5); // Limit to 5 tags as per backend validation
}

/**
 * Format tags array to string
 */
export function formatTags(tags: string[]): string {
  return tags.filter(tag => tag.trim().length > 0).join(', ');
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return !('update_url' in chrome.runtime.getManifest());
}

/**
 * Open options page
 */
export function openOptionsPage(): void {
  chrome.runtime.openOptionsPage();
}

/**
 * Get extension version
 */
export function getExtensionVersion(): string {
  return chrome.runtime.getManifest().version;
}

/**
 * Log with context (only in development)
 */
export function log(...args: any[]): void {
  if (isDevelopment()) {
    console.log('[Magpie Extension]', ...args);
  }
}
