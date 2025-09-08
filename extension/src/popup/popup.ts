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
  ExtensionConfig
} from '../shared/types';
import { getCurrentTab, getPageTitle, parseTags, formatTags, log } from '../shared/utils';

interface PopupState {
  config: ExtensionConfig | null;
  categories: Category[];
  currentTab: chrome.tabs.Tab | null;
  isLoading: boolean;
  saveStatus: SaveStatus;
}

class PopupController {
  private state: PopupState = {
    config: null,
    categories: [],
    currentTab: null,
    isLoading: true,
    saveStatus: 'idle'
  };

  private elements: {
    configRequired: HTMLElement;
    mainContent: HTMLElement;
    loading: HTMLElement;
    pageTitle: HTMLElement;
    pageUrl: HTMLElement;
    categorySelect: HTMLSelectElement;
    tagsInput: HTMLInputElement;
    saveForm: HTMLFormElement;
    publishBtn: HTMLButtonElement;
    statusMessage: HTMLElement;
    optionsBtn: HTMLButtonElement;
    configureBtn: HTMLButtonElement;
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
      categorySelect: document.getElementById('category') as HTMLSelectElement,
      tagsInput: document.getElementById('tags') as HTMLInputElement,
      saveForm: document.getElementById('save-form') as HTMLFormElement,
      publishBtn: document.getElementById('publish-btn') as HTMLButtonElement,
      statusMessage: document.getElementById('status-message')!,
      optionsBtn: document.getElementById('options-btn') as HTMLButtonElement,
      configureBtn: document.getElementById('configure-btn') as HTMLButtonElement,
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

    // Tags input formatting
    this.elements.tagsInput.addEventListener('blur', () => {
      this.formatTagsInput();
    });
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
      this.populateCategories();
      this.populateDefaultValues();
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

  private populateCategories(): void {
    if (!this.elements) return;

    const select = this.elements.categorySelect;
    select.innerHTML = '';

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select category...';
    select.appendChild(defaultOption);

    // Add categories
    this.state.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      select.appendChild(option);
    });

    // Select default category if available
    if (this.state.config?.defaultCategory) {
      select.value = this.state.config.defaultCategory;
    }
  }

  private populateDefaultValues(): void {
    if (!this.elements || !this.state.config) return;

    // Set default tags
    if (this.state.config.defaultTags.length > 0) {
      this.elements.tagsInput.value = formatTags(this.state.config.defaultTags);
    }
  }

  private formatTagsInput(): void {
    if (!this.elements) return;

    const input = this.elements.tagsInput;
    const tags = parseTags(input.value);
    input.value = formatTags(tags);
  }

  private async handleSave(skipConfirm: boolean): Promise<void> {
    if (!this.elements || !this.state.currentTab?.url || this.state.saveStatus === 'saving') {
      return;
    }

    try {
      this.state.saveStatus = 'saving';
      this.updateSaveButtons();

      const category = this.elements.categorySelect.value || this.state.config?.defaultCategory || '未分类';
      const tags = parseTags(this.elements.tagsInput.value);
      const title = getPageTitle(this.state.currentTab);

      const message: SaveLinkMessage = {
        type: MessageType.SAVE_LINK,
        payload: {
          url: this.state.currentTab.url,
          title,
          skipConfirm,
          category,
          tags
        }
      };

      const response = await this.sendMessage(message);

      if (response?.success) {
        this.state.saveStatus = 'success';
        this.showSuccess(
          skipConfirm 
            ? 'Link published successfully!' 
            : 'Link saved for review!'
        );
        
        // Close popup after success
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        throw new Error(response?.error || 'Failed to save link');
      }
    } catch (error) {
      console.error('Save failed:', error);
      this.state.saveStatus = 'error';
      this.showError(error instanceof Error ? error.message : 'Failed to save link');
    } finally {
      setTimeout(() => {
        this.state.saveStatus = 'idle';
        this.updateSaveButtons();
      }, 2000);
    }
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