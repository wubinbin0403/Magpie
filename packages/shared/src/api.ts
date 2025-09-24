// API response types

export interface BaseResponse {
  success: boolean;
  timestamp?: string;
}

export interface SuccessResponse<T = any> extends BaseResponse {
  success: true;
  data: T;
  message?: string;
}

export interface ErrorResponse extends BaseResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

// Pagination types
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Link types
export interface Link {
  id: number;
  url: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  domain: string;
  readingTime?: number; // AI estimated reading time in minutes
  publishedAt: number;
  createdAt: number;
}

export interface PendingLink {
  id: number;
  url: string;
  title: string;
  originalDescription: string;
  aiSummary: string;
  aiCategory: string;
  aiTags: string[];
  aiReadingTime?: number; // AI estimated reading time in minutes
  domain: string;
  createdAt: number;
  userDescription?: string;
  userCategory?: string;
  userTags?: string[];
  status: 'pending';
  scrapingFailed?: boolean;
  aiAnalysisFailed?: boolean;
  aiError?: string;
}

export interface PendingLinkResponse {
  id: number;
  url: string;
  title: string;
  originalDescription: string;
  aiSummary: string;
  aiCategory: string;
  aiTags: string[];
  aiReadingTime?: number; // AI estimated reading time in minutes
  aiAnalysisFailed?: boolean;
  aiError?: string;
  domain: string;
  createdAt: number;
  userDescription?: string;
  userCategory?: string;
  userTags?: string[];
}

// Stats types
export interface CategoryStats {
  name: string;
  count: number;
}

export interface TagStats {
  name: string;
  count: number;
}

export interface DomainStats {
  name: string;
  count: number;
}

export interface YearMonthStats {
  year: number;
  month: number;
  count: number;
}

export interface MonthlyStats {
  year: number;
  month: number;
  count: number;
}

export interface ActivityItem {
  type: 'link_added' | 'link_published' | 'link_deleted';
  title: string;
  url?: string;
  timestamp: string;
}

export type OperationStatus = 'success' | 'failed' | 'pending'

export interface AdminActivityActor {
  type: 'user' | 'token'
  id: number
  name?: string | null
  identifier?: string | null
}

export interface AdminActivityLog {
  id: number
  action: string
  resource?: string | null
  resourceId?: number | null
  status: OperationStatus
  details?: Record<string, unknown> | null
  errorMessage?: string | null
  ip?: string | null
  userAgent?: string | null
  duration?: number | null
  actor?: AdminActivityActor | null
  createdAt: string
}

export interface AdminActivityFilters {
  actions: string[]
  resources: string[]
  statuses: OperationStatus[]
}

export interface AdminActivityResponse {
  logs: AdminActivityLog[]
  pagination: Pagination
  availableFilters: AdminActivityFilters
}

// Search types
export interface SearchResult extends Link {
  score: number;
  highlights: {
    title?: string;
    description?: string;
    tags?: string[];
  };
}

export interface SearchFilters {
  category?: string;
  tags?: string[];
  domain?: string;
  before?: string;
  after?: string;
}

export interface Suggestion {
  text: string;
  type: 'title' | 'tag' | 'category' | 'domain';
  count?: number;
}

// Query parameter types
export interface LinksQuery {
  page?: number;
  limit?: number;
  category?: string;
  tags?: string;
  search?: string;
  domain?: string;
  year?: number;
  month?: number;
  sort?: 'newest' | 'oldest' | 'title' | 'domain';
  status?: 'published';
}

export interface SearchQuery {
  q: string;
  page?: number;
  limit?: number;
  category?: string;
  tags?: string;
  domain?: string;
  before?: string;
  after?: string;
  sort?: 'relevance' | 'newest' | 'oldest';
  highlight?: boolean;
}

export interface SuggestionsQuery {
  q: string;
  type?: 'title' | 'tag' | 'category' | 'domain';
  limit?: number;
}

export interface AddLinkQuery {
  url: string;
  skipConfirm?: boolean;
  category?: string;
  tags?: string;
}

export interface AdminPendingQuery {
  page?: number;
  limit?: number;
  sort?: 'newest' | 'oldest';
  domain?: string;
  category?: string;
}

// Request body types
export interface ConfirmLinkRequest {
  title?: string;
  description: string;
  category: string;
  tags: string[];
  publish?: boolean;
}

export interface UpdateLinkRequest {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  status?: 'pending' | 'published' | 'deleted';
}

export interface AddLinkResponse {
  id: number;
  url: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  status: 'published';
  scrapingFailed?: boolean;
  aiAnalysisFailed?: boolean;
  aiError?: string;
}

export interface ConfirmLinkResponse {
  id: number;
  status: 'published' | 'draft';
  publishedAt?: string;
}

export interface DeleteLinkResponse {
  success: boolean;
  message: string;
}

export interface AdminLoginRequest {
  password: string;
}

export interface AdminInitRequest {
  password: string;
}

export interface CreateTokenRequest {
  name?: string;
  expiresAt?: string;
}

export interface BatchOperationRequest {
  ids: number[];
  action: 'confirm' | 'delete' | 'reanalyze';
  params?: {
    category?: string;
    tags?: string[];
  };
}

export interface UpdateSettingsRequest {
  site?: {
    title?: string;
    description?: string;
    aboutUrl?: string;
  };
  ai?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    temperature?: number;
    userInstructions?: string;
  };
  content?: {
    defaultCategory?: string;
    categories?: string[];
    itemsPerPage?: number;
  };
}

// Response data types
export interface LinksResponse {
  links: Link[];
  pagination: Pagination;
  filters: {
    categories: CategoryStats[];
    tags: TagStats[];
    domains?: DomainStats[];
    yearMonths: YearMonthStats[];
  };
}

export interface SearchResponse {
  results: SearchResult[];
  pagination: Pagination;
  query: {
    originalQuery: string;
    processedQuery: string;
    filters: SearchFilters;
  };
  suggestions?: string[];
  totalTime: number;
}

export interface StatsResponse {
  totalLinks: number;
  publishedLinks: number;
  pendingLinks: number;
  totalCategories: number;
  totalTags: number;
  recentActivity: ActivityItem[];
  popularTags: TagStats[];
  popularDomains: DomainStats[];
  monthlyStats: MonthlyStats[];
}

export interface AdminLoginResponse {
  token: string;
  expiresAt: string;
  user: {
    role: 'admin';
    permissions: string[];
  };
}

export interface SettingsResponse {
  site: {
    title: string;
    description: string;
    aboutUrl?: string;
  };
  ai: {
    apiKey: string; // Masked display
    baseUrl: string;
    model: string;
    temperature: number;
    userInstructions: string;
  };
  content: {
    defaultCategory: string;
    categories: string[];
    itemsPerPage: number;
  };
}

export interface AITestResponse {
  connected: boolean;
  model: string;
  responseTime: number;
  testResult?: {
    summary: string;
    category: string;
    tags: string[];
  };
}

// ==================== ADDITIONAL API TYPES ====================

// Stream types (for add-link-stream)
export interface StreamStatusMessage {
  stage: 'fetching' | 'analyzing' | 'completed' | 'error';
  message: string;
  progress?: number;
  data?: {
    title?: string;
    wordCount?: number;
    scrapingFailed?: boolean;
    summary?: string;
    category?: string;
    tags?: string[];
    id?: number;
    url?: string;
    description?: string;
    status?: string;
  };
  error?: string;
}

// Admin query parameter types
export interface AdminLinksQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'all' | 'published' | 'pending' | 'deleted';
  sort?: 'newest' | 'oldest' | 'title' | 'domain';
  category?: string;
  domain?: string;
}

export interface AdminTokensQuery {
  page?: number;
  limit?: number;
  status?: 'active' | 'revoked';
}

// Admin data types
export interface AdminLink {
  id: number;
  url: string;
  title: string;
  domain: string;
  description: string;
  category: string;
  tags: string[];
  status: 'published' | 'pending' | 'deleted';
  createdAt: number;
  publishedAt?: number;
  readingTime?: number;
}

export interface AdminLinksResponse {
  links: AdminLink[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiToken {
  id: number;
  token: string;
  name?: string;
  prefix: string;
  status: 'active' | 'revoked';
  usageCount: number;
  lastUsedAt?: number;
  lastUsedIp?: string;
  createdAt: number;
  revokedAt?: number;
}

export interface TokensResponse {
  tokens: ApiToken[];
  pagination: Pagination;
}

// Category management types
export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  description?: string;
  displayOrder: number;
  isActive: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateCategoryRequest {
  name: string;
  slug?: string;
  icon?: string;
  description?: string;
  displayOrder?: number;
  isActive?: number;
}

export interface UpdateCategoryRequest extends Partial<CreateCategoryRequest> {}

export interface ReorderCategoriesRequest {
  categoryIds: number[];
}

export interface PublicCategory {
  id: number;
  name: string;
  slug: string;
  icon: string;
  description?: string;
  displayOrder: number;
  linkCount: number;
}

// Batch operations types
export interface BatchOperationResult {
  id: number;
  success: boolean;
  error?: string;
}

export interface BatchOperationResponse {
  processed: number;
  failed: number;
  skipped: number;
  total: number;
  results: BatchOperationResult[];
}

// Domain stats types
export interface DomainStatsResponse {
  domain: string;
  count: number;
  latestPublished?: string;
  latestTitle?: string;
}

// AI test enhancement types
export interface AITestConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  userInstructions?: string;
}

export interface AITestRequest {
  testConfig?: AITestConfig;
}

export interface AITestResponseData {
  connected: boolean;
  model: string;
  baseUrl: string;
  responseTime: number;
  testAnalysis?: {
    summary: string;
    category: string;
    tags: string[];
    language: string;
    sentiment: string;
    readingTime: number;
  };
}

// Additional admin response types
export interface AdminLogoutResponse {
  loggedOut: boolean;
}

export interface AdminCheckResponse {
  exists: boolean;
}

export interface AdminVerifyResponse {
  valid: boolean;
  user: {
    role: 'admin';
    permissions: string[];
  };
}

export interface UpdateSettingsResponse {
  updated: boolean;
}

export interface DeleteTokenResponse {
  id: number;
  status: string;
}

// Response types for individual endpoints
export interface CategoriesResponse extends Array<PublicCategory> {}

// Additional request body types
export interface AddLinkBody {
  url: string;
  category?: string;
  tags?: string;
  skipConfirm?: boolean;
}
