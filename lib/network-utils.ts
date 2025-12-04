/**
 * Network error detection and handling utilities
 */

/**
 * Check if an error is a network error (vs server error)
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true
  }
  
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return (
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('connection') ||
      msg.includes('timeout') ||
      msg.includes('network request failed')
    )
  }
  
  return false
}

/**
 * Check if response indicates a network issue
 */
export function isNetworkResponse(response?: Response): boolean {
  if (!response) return true
  // Network errors usually don't have a response at all
  // But some proxies might return specific status codes
  return response.status === 0 || response.status === 502 || response.status === 503 || response.status === 504
}

/**
 * Retry a fetch operation with exponential backoff
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)
      
      // If it's a network-related response code, retry
      if (attempt < maxRetries - 1 && isNetworkResponse(response)) {
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // If it's a network error and we have retries left, wait and retry
      if (attempt < maxRetries - 1 && isNetworkError(error)) {
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      // If it's not a network error or we're out of retries, throw immediately
      throw error
    }
  }
  
  throw lastError || new Error('Max retries exceeded')
}

/**
 * Get user-friendly error message based on error type
 */
export function getErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return 'Không có kết nối mạng. Vui lòng kiểm tra kết nối và thử lại.'
  }
  
  if (error instanceof Error) {
    return error.message
  }
  
  return 'Đã xảy ra lỗi không xác định'
}

/**
 * Check if browser is currently online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}
