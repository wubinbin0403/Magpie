/**
 * Popup interface logic for Magpie Chrome Extension
 * Handles user interactions and communication with background script
 */

import {
  MessageType,
  ExtensionMessage,
  SaveLinkMessage,
  SaveStatus,
  Category,
  ExtensionConfig,
  LinkResponse
} from '../shared/types';
import { MagpieApiClient } from '../shared/api';
import { getCurrentTab, getPageTitle, log } from '../shared/utils';

interface PopupState {
  config: ExtensionConfig | null;
  currentTab: chrome.tabs.Tab | null;
  isLoading: boolean;
  saveStatus: SaveStatus;
  // categories removed - now handled by AI
}

class PopupController {
  private state: PopupState = {
    config: null,
    currentTab: null,
    isLoading: true,
    saveStatus: 'idle'
    // categories removed - now handled by AI
  };

  private elements: {
    configRequired: HTMLElement;
    mainContent: HTMLElement;
    loading: HTMLElement;
    pageTitle: HTMLElement;
    pageUrl: HTMLElement;
    saveForm: HTMLFormElement;
    publishBtn: HTMLButtonElement;
    statusMessage: HTMLElement;
    optionsBtn: HTMLButtonElement;
    configureBtn: HTMLButtonElement;
    progressContainer: HTMLElement;
    progressText: HTMLElement;
    // categorySelect and tagsInput removed - now handled by AI
  } | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    try {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setupUI());
      } else {
        this.setupUI();
      }

      // Load initial data
      await this.loadInitialData();
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.showError('Failed to initialize extension');
    }
  }

  private setupUI(): void {
    // Get DOM elements
    this.elements = {
      configRequired: document.getElementById('config-required')!,
      mainContent: document.getElementById('main-content')!,
      loading: document.getElementById('loading')!,
      pageTitle: document.getElementById('page-title')!,
      pageUrl: document.getElementById('page-url')!,
      saveForm: document.getElementById('save-form') as HTMLFormElement,
      publishBtn: document.getElementById('publish-btn') as HTMLButtonElement,
      statusMessage: document.getElementById('status-message')!,
      optionsBtn: document.getElementById('options-btn') as HTMLButtonElement,
      configureBtn: document.getElementById('configure-btn') as HTMLButtonElement,
      progressContainer: document.getElementById('progress-container')!,
      progressText: document.getElementById('progress-text')!,
      // categorySelect and tagsInput removed - now handled by AI
    };

    // Set up event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.elements) return;

    // Options button
    this.elements.optionsBtn.addEventListener('click', () => {
      this.openOptions();
    });

    // Configure button
    this.elements.configureBtn.addEventListener('click', () => {
      this.openOptions();
    });

    // Save form submission
    this.elements.saveForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSave(false);
    });

    // Publish button
    this.elements.publishBtn.addEventListener('click', () => {
      this.handleSave(true);
    });

    // Tags input formatting removed - now handled by AI
  }

  private async loadInitialData(): Promise<void> {
    try {
      // Load configuration
      const configResponse = await this.sendMessage({
        type: MessageType.GET_CONFIG
      });

      if (configResponse && configResponse.success !== false) {
        this.state.config = configResponse;
      }

      // Get current tab
      this.state.currentTab = await getCurrentTab();

      // Load categories if configured
      if (this.state.config?.apiToken) {
        await this.loadCategories();
      }

      // Update UI based on configuration state
      this.updateUI();
    } catch (error) {
      console.error('Failed to load initial data:', error);
      this.showError('Failed to load extension data');
    } finally {
      this.state.isLoading = false;
      this.updateLoadingState();
    }
  }

  private async loadCategories(): Promise<void> {
    try {
      // Check authentication first
      const authResponse = await this.sendMessage({
        type: MessageType.CHECK_AUTH
      });

      if (!authResponse?.data?.authenticated) {
        log('Not authenticated, using default categories');
        this.state.categories = [
          { id: '未分类', name: '未分类' }
        ];
        return;
      }

      // If we can add a categories endpoint later, use it here
      // For now, use default categories
      this.state.categories = [
        { id: '未分类', name: '未分类' },
        { id: 'tech', name: 'Technology' },
        { id: 'news', name: 'News' },
        { id: 'learning', name: 'Learning' },
        { id: 'tools', name: 'Tools' }
      ];
    } catch (error) {
      console.error('Failed to load categories:', error);
      // Use fallback categories
      this.state.categories = [
        { id: '未分类', name: '未分类' }
      ];
    }
  }

  private updateUI(): void {
    if (!this.elements) return;

    const isConfigured = this.state.config?.apiToken;

    if (!isConfigured) {
      this.showConfigurationRequired();
    } else {
      this.showMainContent();
      this.populatePageInfo();
      // Form population methods removed - now handled by AI
    }
  }

  private showConfigurationRequired(): void {
    if (!this.elements) return;

    this.elements.configRequired.classList.remove('hidden');
    this.elements.mainContent.classList.add('hidden');
  }

  private showMainContent(): void {
    if (!this.elements) return;

    this.elements.configRequired.classList.add('hidden');
    this.elements.mainContent.classList.remove('hidden');
  }

  private populatePageInfo(): void {
    if (!this.elements || !this.state.currentTab) return;

    const title = getPageTitle(this.state.currentTab);
    const url = this.state.currentTab.url || 'Unknown URL';

    this.elements.pageTitle.textContent = title;
    this.elements.pageUrl.textContent = url;
    this.elements.pageUrl.title = url; // Full URL on hover
  }

  // populateCategories method removed - now handled by AI

  // populateDefaultValues method removed - now handled by AI

  // formatTagsInput method removed - now handled by AI

  private async handleSave(skipConfirm: boolean): Promise<void> {
    if (!this.elements || !this.state.currentTab?.url || this.state.saveStatus === 'saving') {
      return;
    }

    try {
      this.state.saveStatus = 'saving';
      this.updateSaveButtons();
      this.showProgress();

      const submission = {
        url: this.state.currentTab.url,
        skipConfirm
        // category and tags are now determined by AI
      };

      const response = await MagpieApiClient.saveLinkWithProgress(
        submission,
        (progressData) => {
          this.updateProgress(progressData);
        }
      );

      if (response?.success) {
        this.state.saveStatus = 'success';
        this.hideProgress();
        const successMessage = skipConfirm
          ? 'Link published successfully!'
          : 'Link saved for review!';

        let shouldClose = true;

        if (!skipConfirm) {
          const opened = await this.openConfirmPage(response?.data);
          shouldClose = opened;
        }

        this.showSuccess(successMessage);

        if (shouldClose) {
          // Close popup after success
          setTimeout(() => {
            window.close();
          }, 1500);
        }
      } else {
        throw new Error(response?.error || 'Failed to save link');
      }
    } catch (error) {
      console.error('Save failed:', error);
      this.state.saveStatus = 'error';
      this.hideProgress();
      this.showError(error instanceof Error ? error.message : 'Failed to save link');
    } finally {
      setTimeout(() => {
        this.state.saveStatus = 'idle';
        this.updateSaveButtons();
      }, 2000);
    }
  }

  private async openConfirmPage(linkData?: LinkResponse): Promise<boolean> {
    if (!linkData) {
      this.showError('Missing confirmation data');
      return false;
    }

    const config = this.state.config;
    if (!config?.serverUrl) {
      this.showError('Server URL is not configured');
      return false;
    }

    if (!config.apiToken) {
      this.showError('API token is missing');
      return false;
    }

    const confirmPath = linkData.confirmUrl || (linkData.id ? `/confirm/${linkData.id}` : null);
    if (!confirmPath) {
      this.showError('Confirmation link is not available');
      return false;
    }

    let confirmUrl = confirmPath;
    if (!confirmUrl.startsWith('http://') && !confirmUrl.startsWith('https://')) {
      const baseUrl = config.serverUrl.replace(/\/$/, '');
      const normalizedPath = confirmPath.startsWith('/') ? confirmPath : `/${confirmPath}`;
      confirmUrl = `${baseUrl}${normalizedPath}`;
    }

    const separator = confirmUrl.includes('?') ? '&' : '?';
    const confirmUrlWithToken = `${confirmUrl}${separator}token=${encodeURIComponent(config.apiToken)}`;

    try {
      await chrome.tabs.create({ url: confirmUrlWithToken });
      return true;
    } catch (error) {
      console.error('Failed to open confirmation page:', error);
      this.showError('Failed to open confirmation page');
      return false;
    }
  }

  private showProgress(): void {
    if (!this.elements) return;

    this.elements.progressContainer.classList.remove('hidden');
    this.updateProgress({ type: 'start', message: 'Starting...' });
  }

  private hideProgress(): void {
    if (!this.elements) return;
    
    this.elements.progressContainer.classList.add('hidden');
  }

  private updateProgress(data: any): void {
    if (!this.elements) return;
    
    console.log('Progress update:', data);
    
    let message = data.message || 'Processing...';
    
    // Map server stages to user-friendly messages
    switch (data.stage) {
      case 'fetching':
        message = 'Fetching page content...';
        break;
      case 'analyzing':
        message = 'AI is analyzing content...';
        break;
      case 'completed':
        message = 'Complete!';
        break;
      case 'error':
        message = `Error: ${data.error || data.message || 'Unknown error'}`;
        break;
      default:
        // Use the message from server if available
        if (data.message) {
          message = data.message;
        }
        break;
    }
    
    this.elements.progressText.textContent = message;
  }

  private updateSaveButtons(): void {
    if (!this.elements) return;

    const saveBtn = this.elements.saveForm.querySelector('button[type="submit"]') as HTMLButtonElement;
    const publishBtn = this.elements.publishBtn;

    const isLoading = this.state.saveStatus === 'saving';
    const isDisabled = isLoading || !this.state.currentTab?.url;

    // Update save button
    if (saveBtn) {
      saveBtn.disabled = isDisabled;
      if (isLoading) {
        saveBtn.classList.add('loading');
      } else {
        saveBtn.classList.remove('loading');
      }
    }

    // Update publish button
    publishBtn.disabled = isDisabled;
    if (isLoading) {
      publishBtn.classList.add('loading');
    } else {
      publishBtn.classList.remove('loading');
    }
  }

  private updateLoadingState(): void {
    if (!this.elements) return;

    if (this.state.isLoading) {
      this.elements.loading.classList.remove('hidden');
      this.elements.configRequired.classList.add('hidden');
      this.elements.mainContent.classList.add('hidden');
    } else {
      this.elements.loading.classList.add('hidden');
    }
  }

  private showSuccess(message: string): void {
    this.showStatusMessage(message, 'success');
  }

  private showError(message: string): void {
    this.showStatusMessage(message, 'error');
  }

  private showStatusMessage(message: string, type: 'success' | 'error'): void {
    if (!this.elements) return;

    const statusEl = this.elements.statusMessage;
    const textEl = statusEl.querySelector('.status-text');

    if (textEl) {
      textEl.textContent = message;
    }

    // Update classes
    statusEl.classList.remove('hidden', 'success', 'error');
    statusEl.classList.add(type);

    // Hide after delay
    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 5000);
  }

  private openOptions(): void {
    this.sendMessage({
      type: MessageType.OPEN_OPTIONS
    });
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

// Initialize popup when DOM is ready
new PopupController();
