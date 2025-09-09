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
   * @param tempConfig Optional temporary configuration to test (uses saved config if not provided)
   */
  static async testConnection(tempConfig?: { serverUrl?: string; apiToken?: string }): Promise<ApiResponse<{ authenticated: boolean; tokenInfo?: any; responseTime?: number }>> {
    try {
      // Use temporary config if provided, otherwise use saved config
      const serverUrl = tempConfig?.serverUrl || await getServerUrl();
      const token = tempConfig?.apiToken || await getApiToken();
      
      // Record start time for response time measurement
      const startTime = performance.now();
      
      // First, try to get the health endpoint (no auth required)
      const baseUrl = serverUrl.replace(/\/$/, '');
      const healthUrl = `${baseUrl}/api/health`;
      
      try {
        const healthResponse = await fetch(healthUrl);
        if (!healthResponse.ok) {
          return {
            success: false,
            error: 'Cannot connect to server',
          };
        }
      } catch (error) {
        return {
          success: false,
          error: 'Cannot connect to server',
        };
      }

      // Then check if we have a token configured
      if (!token) {
        const responseTime = Math.round(performance.now() - startTime);
        return {
          success: true,
          data: { authenticated: false, responseTime },
        };
      }

      // Validate token format locally first (mgp_ + 64 hex chars)
      if (!token.startsWith('mgp_') || token.length !== 68) {
        return {
          success: true,
          data: { authenticated: false },
          error: 'Invalid token format',
        };
      }

      const hexPart = token.slice(4);
      if (!/^[a-f0-9]{64}$/.test(hexPart)) {
        return {
          success: true,
          data: { authenticated: false },
          error: 'Invalid token format',
        };
      }

      // Now verify the token with the server
      const verifyUrl = `${baseUrl}/api/auth/verify`;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      };
      
      const verifyResponse = await fetch(verifyUrl, {
        method: 'POST',
        headers,
      });

      const verifyData = await verifyResponse.json();
      
      // Calculate response time
      const responseTime = Math.round(performance.now() - startTime);

      if (verifyResponse.ok && verifyData.success && verifyData.data?.valid) {
        return {
          success: true,
          data: { 
            authenticated: true,
            tokenInfo: verifyData.data.token,
            responseTime
          },
        };
      } else {
        return {
          success: true,
          data: { authenticated: false, responseTime },
          error: verifyData.error || 'Invalid or expired token',
        };
      }
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
   * Save link using streaming fetch for progress updates
   * This provides real-time progress feedback during processing
   */
  static async saveLinkWithProgress(
    submission: LinkSubmission,
    onProgress: (message: any) => void
  ): Promise<ApiResponse<LinkResponse>> {
    try {
      const baseUrl = await this.getBaseUrl();
      const headers = await this.getHeaders();
      
      console.log('Starting streaming request to:', `${baseUrl}/api/links/add/stream`);
      console.log('Request headers:', headers);
      console.log('Request body:', submission);
      
      const response = await fetch(`${baseUrl}/api/links/add/stream`, {
        method: 'POST',
        headers: {
          ...headers,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(submission)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult: ApiResponse<LinkResponse> | null = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            // Process any remaining data in buffer
            if (buffer.trim()) {
              const remainingLines = buffer.split('\n');
              for (const line of remainingLines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    console.log('Received final SSE data:', data);
                    onProgress(data);
                    
                    if (data.stage === 'completed') {
                      finalResult = {
                        success: true,
                        data: data.data
                      };
                    } else if (data.stage === 'error') {
                      finalResult = {
                        success: false,
                        error: data.error || data.message || 'Failed to save link'
                      };
                    }
                  } catch (parseError) {
                    console.warn('Failed to parse final SSE line:', line, parseError);
                  }
                }
              }
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                console.log('Received SSE data:', data);
                onProgress(data);
                
                if (data.stage === 'completed') {
                  finalResult = {
                    success: true,
                    data: data.data
                  };
                } else if (data.stage === 'error') {
                  finalResult = {
                    success: false,
                    error: data.error || data.message || 'Failed to save link'
                  };
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE line:', line, parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (finalResult) {
        return finalResult;
      } else {
        console.warn('Stream ended without receiving completion or error stage');
        return {
          success: false,
          error: 'Stream ended without completion'
        };
      }
    } catch (error) {
      console.error('Streaming request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save link'
      };
    }
  }
}

// Export convenience functions
export const saveLink = MagpieApiClient.saveLink.bind(MagpieApiClient);
export const saveLinkWithProgress = MagpieApiClient.saveLinkWithProgress.bind(MagpieApiClient);
export const testConnection = MagpieApiClient.testConnection.bind(MagpieApiClient);
export const getCategories = MagpieApiClient.getCategories.bind(MagpieApiClient);
export const getStats = MagpieApiClient.getStats.bind(MagpieApiClient);