/**
 * Options page logic for Magpie Chrome Extension
 * Handles configuration settings and validation
 */

import { 
  ExtensionConfig, 
  MessageType, 
  ExtensionMessage 
} from '../shared/types';
import { log } from '../shared/utils';
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
      testConnection: document.getElementById('test-connection')!,
      connectionStatus: document.getElementById('connection-status')!,
      statusMessage: document.getElementById('status-message')!
      // defaultCategory and defaultTags removed - now handled by AI
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
      this.showError('加载当前设置失败');
    }
  }

  private populateForm(config: ExtensionConfig): void {
    const serverUrl = this.elements.serverUrl as HTMLInputElement;
    const apiToken = this.elements.apiToken as HTMLInputElement;

    if (serverUrl) serverUrl.value = config.serverUrl || '';
    if (apiToken) apiToken.value = config.apiToken || '';
    // defaultCategory and defaultTags removed - now handled by AI
  }

  private async saveConfig(): Promise<void> {
    try {
      const formData = new FormData(this.form!);
      
      const config: Partial<ExtensionConfig> = {
        serverUrl: formData.get('serverUrl') as string,
        apiToken: formData.get('apiToken') as string
        // defaultCategory and defaultTags removed - now handled by AI
      };

      // Validate required fields
      if (!config.serverUrl || !config.apiToken) {
        this.showError('服务器地址和 API Token 为必填项');
        return;
      }

      // Save configuration using storage
      const { StorageManager } = await import('../shared/storage');
      await StorageManager.setConfig(config);

      this.showSuccess('设置已成功保存！');
      log('Configuration saved:', config);
    } catch (error) {
      console.error('Failed to save config:', error);
      this.showError('保存设置失败');
    }
  }

  private async testConnection(): Promise<void> {
    const button = this.elements.testConnection as HTMLButtonElement;
    const status = this.elements.connectionStatus;

    try {
      // Get current form values (not saved values)
      const serverUrl = (this.elements.serverUrl as HTMLInputElement).value.trim();
      const apiToken = (this.elements.apiToken as HTMLInputElement).value.trim();

      // Validate inputs before testing
      if (!serverUrl) {
        status.classList.remove('hidden', 'loading');
        status.classList.add('error');
        status.textContent = '✗ 请输入服务器地址';
        return;
      }

      // Disable button and show loading
      button.disabled = true;
      button.textContent = '测试中...';
      status.classList.remove('hidden', 'success', 'error');
      status.classList.add('loading');
      status.textContent = '正在测试连接...';

      // Test connection with current form values
      const response = await MagpieApiClient.testConnection({
        serverUrl,
        apiToken: apiToken || undefined
      });

      if (response.success) {
        status.classList.remove('loading');
        
        if (response.data?.authenticated) {
          status.classList.add('success');
          const tokenInfo = response.data.tokenInfo;
          const responseTime = response.data.responseTime;
          if (tokenInfo && responseTime !== undefined) {
            status.textContent = `✓ 连接成功 - Token "${tokenInfo.name}" 可用（${responseTime}ms）`;
          } else {
            status.textContent = '✓ 连接成功并已通过验证';
          }
        } else {
          status.classList.add('error');
          const errorMsg = response.error || '认证失败';
          const responseTime = response.data?.responseTime;
          if (responseTime !== undefined) {
            status.textContent = `✗ 服务器可达但${errorMsg}（${responseTime}ms）`;
          } else {
            status.textContent = `✗ 服务器可达但${errorMsg}`;
          }
        }
      } else {
        throw new Error(response.error || '连接失败');
      }
    } catch (error) {
      status.classList.remove('loading');
      status.classList.add('error');
      status.textContent = `✗ ${error instanceof Error ? error.message : '连接失败'}`;
    } finally {
      // Re-enable button
      button.disabled = false;
      button.textContent = '测试连接';
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
