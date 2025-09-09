/**
 * Background Service Worker for Magpie Chrome Extension
 * Handles extension lifecycle events, context menus, and API communications
 */

import { 
  MessageType, 
  ExtensionMessage, 
  SaveLinkMessage,
  SaveStatus 
} from '../shared/types';
import { MagpieApiClient } from '../shared/api';
import { isConfigured, getConfig } from '../shared/storage';
import { getCurrentTab, getPageTitle, isValidUrl, log, showNotification } from '../shared/utils';

// Context menu item IDs
const CONTEXT_MENU_IDS = {
  SAVE_LINK: 'save-link',
  SAVE_AUTO: 'save-auto',
  OPEN_OPTIONS: 'open-options',
};

/**
 * Extension installation and startup
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  log('Extension installed/updated:', details.reason);
  
  try {
    // Create context menus first (this is critical)
    await createContextMenus();
    
    // Show welcome notification for new installations (non-blocking)
    if (details.reason === 'install') {
      // Don't await this - let it run in background
      showWelcomeNotification().catch((error) => {
        log('Welcome notification failed (non-critical):', error.message || error);
      });
    }
  } catch (error) {
    console.error('Failed to initialize extension:', error);
  }
});

/**
 * Extension startup (browser restart)
 */
chrome.runtime.onStartup.addListener(async () => {
  log('Extension started');
  await createContextMenus();
});

/**
 * Create context menus
 */
async function createContextMenus(): Promise<void> {
  // Remove existing menus first
  await chrome.contextMenus.removeAll();
  
  const configured = await isConfigured();
  
  if (!configured) {
    // If not configured, only show options menu
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.OPEN_OPTIONS,
      title: 'Configure Magpie Extension',
      contexts: ['page', 'link'],
    });
    return;
  }

  // Main save menu for current page
  chrome.contextMenus.create({
    id: CONTEXT_MENU_IDS.SAVE_LINK,
    title: 'Save to Magpie',
    contexts: ['page'],
  });

  // Auto-save menu for current page
  chrome.contextMenus.create({
    id: CONTEXT_MENU_IDS.SAVE_AUTO,
    title: 'Save to Magpie (Auto-publish)',
    contexts: ['page'],
  });

  // Options menu
  chrome.contextMenus.create({
    id: CONTEXT_MENU_IDS.OPEN_OPTIONS,
    title: 'Magpie Options',
    contexts: ['page', 'link'],
  });
}

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  log('Context menu clicked:', info.menuItemId, info);
  
  try {
    switch (info.menuItemId) {
      case CONTEXT_MENU_IDS.SAVE_LINK:
        if (tab?.url) {
          await handleSaveLink(tab.url, getPageTitle(tab), false);
        }
        break;
        
      case CONTEXT_MENU_IDS.SAVE_AUTO:
        if (tab?.url) {
          await handleSaveLink(tab.url, getPageTitle(tab), true);
        }
        break;
        
      case CONTEXT_MENU_IDS.OPEN_OPTIONS:
        chrome.runtime.openOptionsPage();
        break;
    }
  } catch (error) {
    console.error('Context menu handler error:', error);
    await showNotification('Error', 'Failed to process request');
  }
});

/**
 * Handle browser action click (extension icon)
 */
chrome.action.onClicked.addListener(async (tab) => {
  log('Browser action clicked for tab:', tab.id);
  
  // The popup should handle this, but this is a fallback
  // if popup fails to load or in case we want to handle it differently
  try {
    const configured = await isConfigured();
    
    if (!configured) {
      chrome.runtime.openOptionsPage();
      return;
    }

    // In Manifest V3, we prefer to use popup
    // This is just a fallback
    if (tab.url && isValidUrl(tab.url)) {
      await handleSaveLink(tab.url, getPageTitle(tab), false);
    }
  } catch (error) {
    console.error('Browser action handler error:', error);
  }
});

/**
 * Handle messages from popup, options page, or content scripts
 */
chrome.runtime.onMessage.addListener((
  message: ExtensionMessage,
  sender,
  sendResponse
) => {
  log('Received message:', message.type, message);
  
  // Handle async operations
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    });
  
  // Return true to indicate async response
  return true;
});

/**
 * Handle incoming messages
 */
async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<any> {
  switch (message.type) {
    case MessageType.SAVE_LINK:
      return await handleSaveLinkMessage(message as SaveLinkMessage);
      
    case MessageType.GET_CONFIG:
      return await getConfig();
      
    case MessageType.CHECK_AUTH:
      return await MagpieApiClient.testConnection();
      
    case MessageType.OPEN_OPTIONS:
      chrome.runtime.openOptionsPage();
      return { success: true };
      
    default:
      log('Unknown message type:', message.type);
      return { success: false, error: 'Unknown message type' };
  }
}

/**
 * Handle save link message from popup
 */
async function handleSaveLinkMessage(message: SaveLinkMessage): Promise<any> {
  const { url, title, skipConfirm } = message.payload;
  return await handleSaveLink(url, title, skipConfirm || false);
}

/**
 * Core link saving logic
 */
async function handleSaveLink(
  url: string,
  title: string,
  skipConfirm: boolean = false
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    log('Saving link:', { url, title, skipConfirm });
    
    // Validate URL
    if (!isValidUrl(url)) {
      throw new Error('Invalid URL');
    }

    // Check configuration
    const configured = await isConfigured();
    if (!configured) {
      throw new Error('Extension not configured. Please set up API token.');
    }

    // Create submission with just URL and skipConfirm
    // AI will determine category and tags on the server
    const submission = {
      url,
      skipConfirm
    };

    // Show saving notification (non-blocking)
    showNotification(
      'Magpie',
      skipConfirm ? 'Publishing link...' : 'Saving link...',
    ).catch((notifError) => {
      log('Saving notification failed:', notifError.message);
    });

    // Save the link
    const response = await MagpieApiClient.saveLink(submission);
    
    log('API Response received:', response);
    
    if (response.success) {
      const linkData = response.data;
      log('Link data:', linkData);
      
      // Show success notification (non-blocking)
      const successMessage = skipConfirm 
        ? `"${title}" has been published to Magpie`
        : `"${title}" saved for confirmation`;
      
      showNotification(
        skipConfirm ? 'Link Published' : 'Link Saved',
        successMessage,
      ).catch((notifError) => {
        log('Success notification failed:', notifError.message);
      });
      
      // Optionally log confirmation URL
      if (linkData && linkData.confirmUrl) {
        log('Link saved with confirmation URL:', linkData.confirmUrl);
      }
      
      return { success: true, data: linkData };
    } else {
      log('API response error:', response.error);
      throw new Error(response.error || 'Failed to save link');
    }
  } catch (error) {
    console.error('Failed to save link:', error);
    
    // Show error notification (non-blocking)
    showNotification(
      'Save Failed',
      error instanceof Error ? error.message : 'Unknown error occurred',
    ).catch((notifError) => {
      log('Error notification failed:', notifError.message);
    });
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Show welcome notification for new users
 */
async function showWelcomeNotification(): Promise<void> {
  try {
    // Small delay to ensure extension is fully loaded
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await showNotification(
      'Welcome to Magpie!',
      'Click the extension icon to get started, or right-click to configure.',
    );
    
    log('Welcome notification shown successfully');
  } catch (error) {
    // This is non-critical, so just log it
    log('Welcome notification could not be shown:', error.message || error);
  }
}

/**
 * Handle storage changes to update context menus
 */
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'sync') {
    log('Storage changed:', changes);
    
    // Recreate context menus if configuration changed
    if ('apiToken' in changes) {
      await createContextMenus();
    }
  }
});

/**
 * Handle extension lifecycle
 */
chrome.runtime.onSuspend.addListener(() => {
  log('Extension suspending');
});

// Log extension startup
log('Background script loaded, extension version:', chrome.runtime.getManifest().version);