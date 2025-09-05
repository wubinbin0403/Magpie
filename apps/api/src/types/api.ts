// API 响应类型定义

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

// 分页相关类型
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// 链接相关类型
export interface Link {
  id: number;
  url: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  domain: string;
  readingTime?: number; // AI estimated reading time in minutes
  publishedAt: string;
  createdAt: string;
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
  createdAt: string;
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
  aiAnalysisFailed?: boolean;
  aiError?: string;
  domain: string;
  createdAt: string;
  userDescription?: string;
  userCategory?: string;
  userTags?: string[];
}

// 统计相关类型
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

// 搜索相关类型
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

// 查询参数类型
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

// 请求体类型
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
    summaryPrompt?: string;
    categoryPrompt?: string;
  };
  content?: {
    defaultCategory?: string;
    categories?: string[];
    itemsPerPage?: number;
  };
}

// 响应数据类型
export interface LinksResponse {
  links: Link[];
  pagination: Pagination;
  filters: {
    categories: CategoryStats[];
    tags: TagStats[];
    domains: DomainStats[];
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
    apiKey: string; // 脱敏显示
    baseUrl: string;
    model: string;
    temperature: number;
    summaryPrompt: string;
    categoryPrompt: string;
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