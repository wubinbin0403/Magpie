/**
 * Shared types for the Magpie Chrome Extension
 */

// Storage keys enum for type safety
export enum StorageKeys {
  API_TOKEN = 'apiToken',
  SERVER_URL = 'serverUrl',
  DEFAULT_CATEGORY = 'defaultCategory',
  DEFAULT_TAGS = 'defaultTags',
  AUTO_PUBLISH = 'autoPublish',
  LAST_SYNC = 'lastSync',
  USER_PREFERENCES = 'userPreferences'
}

// Configuration interface
export interface ExtensionConfig {
  apiToken: string | null;
  serverUrl: string;
  defaultCategory: string;
  defaultTags: string[];
  autoPublish: boolean;
}

// User preferences
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  showNotifications: boolean;
  debugMode: boolean;
}

// API Response types (matching the backend)
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Link data for submission
export interface LinkSubmission {
  url: string;
  skipConfirm: boolean;
  category?: string;
  tags?: string;
}

// Link response from API
export interface LinkResponse {
  id: number;
  url: string;
  title: string;
  status: 'pending' | 'published';
  scrapingFailed?: boolean;
  aiAnalysisFailed?: boolean;
  confirmUrl?: string;
}

// Message types for communication between extension components
export enum MessageType {
  SAVE_LINK = 'SAVE_LINK',
  GET_CONFIG = 'GET_CONFIG',
  UPDATE_CONFIG = 'UPDATE_CONFIG',
  CHECK_AUTH = 'CHECK_AUTH',
  OPEN_OPTIONS = 'OPEN_OPTIONS',
  SHOW_NOTIFICATION = 'SHOW_NOTIFICATION'
}

// Message interfaces
export interface ExtensionMessage {
  type: MessageType;
  payload?: any;
}

export interface SaveLinkMessage extends ExtensionMessage {
  type: MessageType.SAVE_LINK;
  payload: {
    url: string;
    title: string;
    skipConfirm?: boolean;
    category?: string;
    tags?: string[];
  };
}

// Status types for UI feedback
export type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export interface SaveResult {
  status: SaveStatus;
  message?: string;
  linkId?: number;
  confirmUrl?: string;
}

// Category type (from backend)
export interface Category {
  id: string;
  name: string;
  count?: number;
}

// Default values
export const DEFAULT_CONFIG: ExtensionConfig = {
  apiToken: null,
  serverUrl: 'http://localhost:3001',
  defaultCategory: '未分类',
  defaultTags: [],
  autoPublish: false
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'auto',
  showNotifications: true,
  debugMode: false
};