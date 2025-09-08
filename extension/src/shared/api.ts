/**
 * API client module for Magpie Chrome Extension
 * Handles all communication with the Magpie backend API
 */

import { 
  ApiResponse, 
  LinkSubmission, 
  LinkResponse, 
  Category 
} from './types';
import { getApiToken, getServerUrl } from './storage';

export class MagpieApiClient {
  private static async getHeaders(): Promise<HeadersInit> {
    const token = await getApiToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  private static async getBaseUrl(): Promise<string> {
    const serverUrl = await getServerUrl();
    // Ensure no trailing slash
    return serverUrl.replace(/\/$/, '');
  }

  /**
   * Generic fetch wrapper with error handling
   */
  private static async fetchApi<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const baseUrl = await this.getBaseUrl();
      const headers = await this.getHeaders();
      const url = `${baseUrl}${endpoint}`;
      
      // Add detailed logging for debugging
      console.log('API Request URL:', url);
      console.log('API Request Headers:', headers);
      console.log('API Request Options:', options);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        // Return a generic success response for non-JSON responses
        return {
          success: true,
          data: null as any,
        };
      }

      const data = await response.json();
      
      // Add detailed logging for debugging
      console.log('API Response Status:', response.status);
      console.log('API Response Data:', JSON.stringify(data, null, 2));
      console.log('Response OK:', response.ok);
      
      if (!response.ok) {
        console.error('API Error Response:', JSON.stringify(data, null, 2));
        return {
          success: false,
          error: data.error?.message || data.error || data.message || 'Request failed',
          message: data.message,
        };
      }

      // Check if the backend returned a wrapped response format
      if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
        // Backend response format: { success: true, data: ..., message: ... }
        console.log('Backend wrapped response detected');
        return data; // Return as-is, it already has the correct format
      }

      // Legacy or direct response format
      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Save a link to Magpie
   */
  static async saveLink(submission: LinkSubmission): Promise<ApiResponse<LinkResponse>> {
    return this.fetchApi<LinkResponse>('/api/links', {
      method: 'POST',
      body: JSON.stringify(submission),
    });
  }

  /**
   * Test API connection and authentication
   */
  static async testConnection(): Promise<ApiResponse<{ authenticated: boolean }>> {
    try {
      // First, try to get the health endpoint (no auth required)
      const healthResponse = await this.fetchApi<any>('/api/health');
      
      if (!healthResponse.success) {
        return {
          success: false,
          error: 'Cannot connect to server',
        };
      }

      // Then check if we have a valid token format
      const token = await getApiToken();
      if (!token) {
        return {
          success: true,
          data: { authenticated: false },
        };
      }

      // Validate token format (mgp_ + 64 hex chars)
      if (!token.startsWith('mgp_') || token.length !== 68) {
        return {
          success: true,
          data: { authenticated: false },
        };
      }

      const hexPart = token.slice(4);
      if (!/^[a-f0-9]{64}$/.test(hexPart)) {
        return {
          success: true,
          data: { authenticated: false },
        };
      }

      // Token format is valid, we assume it's authenticated
      // Real authentication testing will happen when actually using the API
      return {
        success: true,
        data: { authenticated: true },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * Get available categories
   */
  static async getCategories(): Promise<ApiResponse<Category[]>> {
    return this.fetchApi<Category[]>('/api/categories');
  }

  /**
   * Get server statistics (public endpoint)
   */
  static async getStats(): Promise<ApiResponse<any>> {
    return this.fetchApi<any>('/api/stats');
  }

  /**
   * Save link using Server-Sent Events for progress updates
   * This is for advanced use cases where we want real-time progress
   */
  static async saveLinkWithProgress(
    submission: LinkSubmission,
    onProgress: (message: any) => void
  ): Promise<ApiResponse<LinkResponse>> {
    try {
      const baseUrl = await this.getBaseUrl();
      const headers = await this.getHeaders();
      
      // Use the streaming endpoint
      const eventSource = new EventSource(
        `${baseUrl}/api/links/add/stream`,
        {
          // Note: EventSource doesn't support custom headers in the constructor
          // We'll need to pass the token as a query parameter for SSE
        }
      );

      return new Promise((resolve) => {
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            onProgress(data);
            
            if (data.type === 'complete' || data.type === 'error') {
              eventSource.close();
              
              if (data.type === 'complete') {
                resolve({
                  success: true,
                  data: data.data,
                });
              } else {
                resolve({
                  success: false,
                  error: data.error || 'Failed to save link',
                });
              }
            }
          } catch (error) {
            console.error('Failed to parse SSE message:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('SSE error:', error);
          eventSource.close();
          resolve({
            success: false,
            error: 'Connection to server lost',
          });
        };

        // Send the actual POST request
        fetch(`${baseUrl}/api/links/add/stream`, {
          method: 'POST',
          headers,
          body: JSON.stringify(submission),
        }).catch((error) => {
          eventSource.close();
          resolve({
            success: false,
            error: error.message,
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save link',
      };
    }
  }
}

// Export convenience functions
export const saveLink = MagpieApiClient.saveLink.bind(MagpieApiClient);
export const testConnection = MagpieApiClient.testConnection.bind(MagpieApiClient);
export const getCategories = MagpieApiClient.getCategories.bind(MagpieApiClient);
export const getStats = MagpieApiClient.getStats.bind(MagpieApiClient);