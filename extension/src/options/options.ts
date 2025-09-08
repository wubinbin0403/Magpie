/**
 * Options page logic for Magpie Chrome Extension
 * Handles configuration settings and validation
 */

import { 
  ExtensionConfig, 
  MessageType, 
  ExtensionMessage 
} from '../shared/types';
import { parseTags, formatTags, log } from '../shared/utils';
import { MagpieApiClient } from '../shared/api';

class OptionsController {
  private form: HTMLFormElement | null = null;
  private elements: Record<string, HTMLElement> = {};

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupUI());
    } else {
      this.setupUI();
    }
  }

  private setupUI(): void {
    this.form = document.getElementById('config-form') as HTMLFormElement;
    
    // Get form elements
    this.elements = {
      serverUrl: document.getElementById('server-url')!,
      apiToken: document.getElementById('api-token')!,
      defaultCategory: document.getElementById('default-category')!,
      defaultTags: document.getElementById('default-tags')!,
      autoPublish: document.getElementById('auto-publish')!,
      testConnection: document.getElementById('test-connection')!,
      connectionStatus: document.getElementById('connection-status')!,
      statusMessage: document.getElementById('status-message')!
    };

    this.setupEventListeners();
    this.loadCurrentConfig();
  }

  private setupEventListeners(): void {
    // Form submission
    this.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveConfig();
    });

    // Test connection
    this.elements.testConnection?.addEventListener('click', () => {
      this.testConnection();
    });
  }

  private async loadCurrentConfig(): Promise<void> {
    try {
      const response = await this.sendMessage({
        type: MessageType.GET_CONFIG
      });

      if (response && response.success !== false) {
        this.populateForm(response);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      this.showError('Failed to load current settings');
    }
  }

  private populateForm(config: ExtensionConfig): void {
    const serverUrl = this.elements.serverUrl as HTMLInputElement;
    const apiToken = this.elements.apiToken as HTMLInputElement;
    const defaultCategory = this.elements.defaultCategory as HTMLInputElement;
    const defaultTags = this.elements.defaultTags as HTMLInputElement;
    const autoPublish = this.elements.autoPublish as HTMLInputElement;

    if (serverUrl) serverUrl.value = config.serverUrl || '';
    if (apiToken) apiToken.value = config.apiToken || '';
    if (defaultCategory) defaultCategory.value = config.defaultCategory || '未分类';
    if (defaultTags) defaultTags.value = formatTags(config.defaultTags || []);
    if (autoPublish) autoPublish.checked = config.autoPublish || false;
  }

  private async saveConfig(): Promise<void> {
    try {
      const formData = new FormData(this.form!);
      
      const config: Partial<ExtensionConfig> = {
        serverUrl: formData.get('serverUrl') as string,
        apiToken: formData.get('apiToken') as string,
        defaultCategory: formData.get('defaultCategory') as string,
        defaultTags: parseTags(formData.get('defaultTags') as string || ''),
        autoPublish: formData.has('autoPublish')
      };

      // Validate required fields
      if (!config.serverUrl || !config.apiToken) {
        this.showError('Server URL and API Token are required');
        return;
      }

      // Save configuration using storage
      const { StorageManager } = await import('../shared/storage');
      await StorageManager.setConfig(config);

      this.showSuccess('Settings saved successfully!');
      log('Configuration saved:', config);
    } catch (error) {
      console.error('Failed to save config:', error);
      this.showError('Failed to save settings');
    }
  }

  private async testConnection(): Promise<void> {
    const button = this.elements.testConnection as HTMLButtonElement;
    const status = this.elements.connectionStatus;

    try {
      // Disable button and show loading
      button.disabled = true;
      button.textContent = 'Testing...';
      status.classList.remove('hidden', 'success', 'error');
      status.classList.add('loading');
      status.textContent = 'Testing connection...';

      // Test connection
      const response = await MagpieApiClient.testConnection();

      if (response.success) {
        status.classList.remove('loading');
        status.classList.add('success');
        
        if (response.data?.authenticated) {
          status.textContent = '✓ Connection successful and authenticated';
        } else {
          status.textContent = '✓ Server reachable but authentication failed';
        }
      } else {
        throw new Error(response.error || 'Connection failed');
      }
    } catch (error) {
      status.classList.remove('loading');
      status.classList.add('error');
      status.textContent = `✗ ${error instanceof Error ? error.message : 'Connection failed'}`;
    } finally {
      // Re-enable button
      button.disabled = false;
      button.textContent = 'Test Connection';
    }
  }

  private showSuccess(message: string): void {
    this.showStatusMessage(message, 'success');
  }

  private showError(message: string): void {
    this.showStatusMessage(message, 'error');
  }

  private showStatusMessage(message: string, type: 'success' | 'error'): void {
    const statusEl = this.elements.statusMessage;
    const textEl = statusEl.querySelector('.status-text');

    if (textEl) {
      textEl.textContent = message;
    }

    statusEl.classList.remove('hidden', 'success', 'error');
    statusEl.classList.add(type);

    // Hide after delay
    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 5000);
  }

  private async sendMessage(message: ExtensionMessage): Promise<any> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Message error:', chrome.runtime.lastError);
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response);
        }
      });
    });
  }
}

// Initialize options page
new OptionsController();