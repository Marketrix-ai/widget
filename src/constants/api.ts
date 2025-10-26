/**
 * API constants and configuration
 *
 * This file contains all API-related constants including endpoints,
 * timeout values, headers, and other API configuration.
 */

// API endpoints
export const API_ENDPOINTS = {
  INTEGRATION_SEARCH: '/integration/search',
  TOUR_SEARCH: '/tour/search',
  CONNECTION_SEARCH: '/connection/search',
  AGENT_SEARCH: '/agent/search',
  USER_SEARCH: '/user/search',
  TENANT_SEARCH: '/tenant/search',
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Request timeout values
export const TIMEOUTS = {
  DEFAULT: 10000, // 10 seconds
  LONG: 30000, // 30 seconds
  SHORT: 5000, // 5 seconds
} as const;

// Header names
export const HEADERS = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  ACCEPT: 'Accept',
  USER_AGENT: 'User-Agent',
  X_API_KEY: 'X-API-Key',
  X_REQUEST_ID: 'X-Request-ID',
} as const;

// Content types
export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM_DATA: 'multipart/form-data',
  URL_ENCODED: 'application/x-www-form-urlencoded',
  TEXT: 'text/plain',
} as const;

// API response status
export const API_RESPONSE_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
} as const;

// Error codes
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

// Retry configuration
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  INITIAL_DELAY: 1000, // 1 second
  MAX_DELAY: 10000, // 10 seconds
  BACKOFF_FACTOR: 2,
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// Cache configuration
export const CACHE_CONFIG = {
  DEFAULT_TTL: 300000, // 5 minutes
  LONG_TTL: 1800000, // 30 minutes
  SHORT_TTL: 60000, // 1 minute
} as const;

// API version
export const API_VERSION = 'v1' as const;

// Base API configuration
export const API_CONFIG = {
  VERSION: API_VERSION,
  TIMEOUT: TIMEOUTS.DEFAULT,
  RETRY: RETRY_CONFIG,
  CACHE: CACHE_CONFIG,
  PAGINATION,
} as const;
