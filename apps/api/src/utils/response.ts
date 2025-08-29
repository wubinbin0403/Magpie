import type { Context } from 'hono'
import type { ApiResponse, SuccessResponse, ErrorResponse } from '../types/api.js'

export function success<T = any>(
  data: T,
  message?: string,
  status: number = 200
): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  }
}

export function error(
  code: string,
  message: string,
  details?: any,
  status: number = 400
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
  }
}

export function sendSuccess<T = any>(
  c: Context,
  data: T,
  message?: string,
  status: number = 200
) {
  return c.json(success(data, message), status)
}

export function sendError(
  c: Context,
  code: string,
  message: string,
  details?: any,
  status: number = 400
) {
  return c.json(error(code, message, details), status)
}

// 常用错误响应
export function notFound(c: Context, message: string = 'Resource not found') {
  return sendError(c, 'NOT_FOUND', message, undefined, 404)
}

export function badRequest(c: Context, message: string = 'Invalid request') {
  return sendError(c, 'VALIDATION_ERROR', message, undefined, 400)
}

export function unauthorized(c: Context, message: string = 'Authentication required') {
  return sendError(c, 'AUTH_REQUIRED', message, undefined, 401)
}

export function forbidden(c: Context, message: string = 'Permission denied') {
  return sendError(c, 'FORBIDDEN', message, undefined, 403)
}

export function internalError(c: Context, message: string = 'Internal server error') {
  return sendError(c, 'INTERNAL_SERVER_ERROR', message, undefined, 500)
}