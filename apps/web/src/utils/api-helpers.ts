import type { ApiResponse } from '@magpie/shared'

// Type guards for API responses
export function isSuccessResponse<T>(response: ApiResponse<T>): response is { success: true; data: T; message?: string; timestamp?: string } {
  return response.success === true
}

export function isErrorResponse(response: ApiResponse<any>): response is { success: false; error: { code: string; message: string; details?: any }; timestamp?: string } {
  return response.success === false
}

// Utility functions for safe API response handling
export function getResponseData<T>(response: ApiResponse<T>): T | null {
  return isSuccessResponse(response) ? response.data : null
}

export function getResponseError(response: ApiResponse<any>): string | null {
  return isErrorResponse(response) ? response.error.message : null
}

// Hook helper for handling API responses in React components
export function useApiResponse<T>(response: ApiResponse<T> | undefined) {
  if (!response) {
    return { data: null, error: null, loading: true }
  }

  if (isSuccessResponse(response)) {
    return { data: response.data, error: null, loading: false }
  }

  if (isErrorResponse(response)) {
    return { data: null, error: response.error.message, loading: false }
  }

  return { data: null, error: null, loading: true }
}