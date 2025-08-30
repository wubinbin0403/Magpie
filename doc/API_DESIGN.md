# Magpie 后端 API 设计文档

## 🛠 API 设计原则

- **RESTful 设计**：遵循 REST 设计规范
- **统一响应格式**：所有 API 返回标准化 JSON 格式
- **权限分级**：公开 API、认证 API、管理员 API
- **性能优化**：支持分页、筛选、缓存
- **错误处理**：友好的错误信息和状态码

## 🔐 认证机制

系统支持双重认证机制，根据使用场景选择：

### 1. API Token 认证（用于扩展和API调用）
```
Authorization: Bearer mgp_xxxxxxxxxxxxxxxxxxxx
```
- 用于浏览器扩展
- 用于外部 API 集成
- 长期有效，可配置权限

### 2. Session 认证（用于管理页面）
```
Authorization: Bearer session_xxxxxxxxxxxxxxxxxxxx
```
- 用于管理员 Web 界面
- 基于用户名密码登录
- 支持过期时间和自动续期

### 权限级别
- **公开访问**：链接列表、搜索等
- **Token 认证**：添加链接、确认操作  
- **管理员认证**：系统设置、用户管理、Token管理

## 🔗 核心 API 端点分析

## 一、公开 API（无需认证）

### 1. 获取链接列表
```typescript
GET /api/links
```

**查询参数：**
```typescript
interface LinksQuery {
  page?: number;           // 页码，默认 1
  limit?: number;          // 每页数量，默认 20，最大 100
  category?: string;       // 分类筛选
  tags?: string;          // 标签筛选，逗号分隔
  search?: string;        // 搜索关键词
  domain?: string;        // 域名筛选
  year?: number;          // 年份筛选
  month?: number;         // 月份筛选 (1-12)
  sort?: 'newest' | 'oldest' | 'title' | 'domain'; // 排序方式
  status?: 'published';   // 状态筛选（公开只能查看已发布）
}
```

**响应格式：**
```typescript
interface LinksResponse {
  success: boolean;
  data: {
    links: Link[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    filters: {
      categories: CategoryStats[];
      tags: TagStats[];
      domains: DomainStats[];
      yearMonths: YearMonthStats[];
    };
  };
  message?: string;
}

interface Link {
  id: number;
  url: string;
  title: string;
  description: string;      // 用户最终确认的描述
  category: string;
  tags: string[];
  domain: string;           // 从 URL 提取的域名
  publishedAt: string;      // ISO 8601 格式
  createdAt: string;
}

interface CategoryStats {
  name: string;
  count: number;
}

interface TagStats {
  name: string;
  count: number;
}
```

### 2. 搜索链接
```typescript
GET /api/search
```

**查询参数：**
```typescript
interface SearchQuery {
  q: string;               // 搜索关键词
  page?: number;
  limit?: number;
  category?: string;
  tags?: string;
  domain?: string;
  before?: string;         // 日期筛选 YYYY-MM-DD
  after?: string;
  sort?: 'relevance' | 'newest' | 'oldest';
  highlight?: boolean;     // 是否返回高亮标记，默认 true
}
```

**响应格式：**
```typescript
interface SearchResponse {
  success: boolean;
  data: {
    results: SearchResult[];
    pagination: Pagination;
    query: {
      originalQuery: string;
      processedQuery: string;
      filters: SearchFilters;
    };
    suggestions?: string[];  // 搜索建议
    totalTime: number;       // 搜索耗时（毫秒）
  };
}

interface SearchResult extends Link {
  score: number;           // 相关性得分
  highlights: {
    title?: string;        // 高亮后的标题
    description?: string;  // 高亮后的描述
    tags?: string[];      // 高亮后的标签
  };
}
```

### 3. 获取搜索建议
```typescript
GET /api/search/suggestions
```

**查询参数：**
```typescript
interface SuggestionsQuery {
  q: string;               // 输入内容
  type?: 'title' | 'tag' | 'category' | 'domain'; // 建议类型
  limit?: number;          // 返回数量，默认 10
}
```

**响应格式：**
```typescript
interface SuggestionsResponse {
  success: boolean;
  data: {
    suggestions: Suggestion[];
  };
}

interface Suggestion {
  text: string;
  type: 'title' | 'tag' | 'category' | 'domain';
  count?: number;          // 相关条目数量
}
```

### 4. 获取统计信息
```typescript
GET /api/stats
```

**响应格式：**
```typescript
interface StatsResponse {
  success: boolean;
  data: {
    totalLinks: number;
    publishedLinks: number;
    pendingLinks: number;
    totalCategories: number;
    totalTags: number;
    recentActivity: ActivityItem[];
    popularTags: TagStats[];
    popularDomains: DomainStats[];
    monthlyStats: MonthlyStats[];
  };
}

interface ActivityItem {
  type: 'link_added' | 'link_published' | 'link_deleted';
  title: string;
  url?: string;
  timestamp: string;
}
```

## 二、认证 API（需要 Token）

### 1. 添加新链接（流程页面）
```typescript
GET /api/links/add?url=xxx&skipConfirm=false
```

**查询参数：**
```typescript
interface AddLinkQuery {
  url: string;             // 必需，要添加的 URL
  skipConfirm?: boolean;   // 是否跳过确认，默认 false
  category?: string;       // 预设分类
  tags?: string;          // 预设标签，逗号分隔
}
```

**处理流程：**
1. 验证 URL 有效性
2. 检查是否已存在
3. 抓取网页内容
4. 调用 AI 生成摘要和分类
5. 保存到数据库（pending 状态）
6. 返回处理结果或 302 跳转

**响应格式（跳过确认时）：**
```typescript
interface AddLinkResponse {
  success: boolean;
  data: {
    id: number;
    url: string;
    title: string;
    description: string;
    category: string;
    tags: string[];
    status: 'published';
  };
}
```

**响应格式（需要确认时）：**
- 返回 HTML 页面显示处理进度
- 完成后 302 跳转到 `/confirm/:id`

### 2. 获取待确认链接详情
```typescript
GET /api/links/:id/pending
```

**响应格式：**
```typescript
interface PendingLinkResponse {
  success: boolean;
  data: {
    id: number;
    url: string;
    title: string;
    originalDescription: string;  // 网页原始描述
    aiSummary: string;           // AI 生成的摘要
    aiCategory: string;          // AI 建议的分类
    aiTags: string[];           // AI 建议的标签
    domain: string;
    createdAt: string;
    
    // 供用户编辑的字段
    userDescription?: string;    // 用户自定义描述
    userCategory?: string;       // 用户选择的分类
    userTags?: string[];        // 用户选择的标签
  };
}
```

### 3. 确认发布链接
```typescript
POST /api/links/:id/confirm
```

**请求体：**
```typescript
interface ConfirmLinkRequest {
  title?: string;          // 可选，修改标题
  description: string;     // 最终描述
  category: string;        // 最终分类
  tags: string[];         // 最终标签
  publish: boolean;       // 是否立即发布，默认 true
}
```

**响应格式：**
```typescript
interface ConfirmLinkResponse {
  success: boolean;
  data: {
    id: number;
    status: 'published' | 'draft';
    publishedAt?: string;
  };
  message: string;
}
```

### 4. 删除链接
```typescript
DELETE /api/links/:id
```

**响应格式：**
```typescript
interface DeleteLinkResponse {
  success: boolean;
  message: string;
}
```

### 5. 编辑链接
```typescript
PUT /api/links/:id
```

**请求体：**
```typescript
interface UpdateLinkRequest {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  status?: 'pending' | 'published' | 'deleted';
}
```

## 三、管理员 API

### 1. 管理员登录/验证
```typescript
POST /api/admin/login
```

**请求体：**
```typescript
interface AdminLoginRequest {
  password: string;        // 管理员密码或 Token
}
```

**响应格式：**
```typescript
interface AdminLoginResponse {
  success: boolean;
  data: {
    token: string;         // JWT token 或类似
    expiresAt: string;
    user: {
      role: 'admin';
      permissions: string[];
    };
  };
}
```

### 2. 初始化管理员账户
```typescript
POST /api/admin/init
```

**请求体：**
```typescript
interface AdminInitRequest {
  password: string;        // 新的管理员密码
}
```

### 3. 获取待确认链接列表
```typescript
GET /api/admin/pending
```

**查询参数：**
```typescript
interface AdminPendingQuery {
  page?: number;
  limit?: number;
  sort?: 'newest' | 'oldest';
  domain?: string;
  category?: string;
}
```

**响应格式：**
```typescript
interface AdminPendingResponse {
  success: boolean;
  data: {
    links: PendingLink[];
    pagination: Pagination;
  };
}

interface PendingLink {
  id: number;
  url: string;
  title: string;
  domain: string;
  aiSummary: string;
  aiCategory: string;
  aiTags: string[];
  createdAt: string;
  status: 'pending';
}
```

### 4. 批量操作待确认链接
```typescript
POST /api/admin/pending/batch
```

**请求体：**
```typescript
interface BatchOperationRequest {
  ids: number[];
  action: 'confirm' | 'delete' | 'reanalyze';
  params?: {
    category?: string;     // 批量确认时使用
    tags?: string[];
  };
}
```

### 5. API Token 管理

#### 5.1 获取 Token 列表
```typescript
GET /api/admin/tokens
```

#### 5.2 生成新 Token
```typescript
POST /api/admin/tokens
```

**请求体：**
```typescript
interface CreateTokenRequest {
  name?: string;           // Token 备注名称
  expiresAt?: string;     // 过期时间，可选
}
```

#### 5.3 撤销 Token
```typescript
DELETE /api/admin/tokens/:tokenId
```

### 6. 系统设置

#### 6.1 获取设置
```typescript
GET /api/admin/settings
```

**响应格式：**
```typescript
interface SettingsResponse {
  success: boolean;
  data: {
    site: {
      title: string;
      description: string;
      aboutUrl?: string;
    };
    ai: {
      apiKey: string;      // 脱敏显示
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
  };
}
```

#### 6.2 更新设置
```typescript
PUT /api/admin/settings
```

**请求体：**
```typescript
interface UpdateSettingsRequest {
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
```

#### 6.3 测试 AI 连接
```typescript
POST /api/admin/settings/ai/test
```

**响应格式：**
```typescript
interface AITestResponse {
  success: boolean;
  data: {
    connected: boolean;
    model: string;
    responseTime: number;
    testResult?: {
      summary: string;
      category: string;
      tags: string[];
    };
  };
}
```

### 7. 分类管理

#### 7.1 获取分类列表
```typescript
GET /api/admin/categories
```

#### 7.2 创建分类
```typescript
POST /api/admin/categories
```

#### 7.3 更新分类
```typescript
PUT /api/admin/categories/:id
```

#### 7.4 删除分类
```typescript
DELETE /api/admin/categories/:id
```

## 四、特殊端点

### 1. 健康检查
```typescript
GET /api/health
```

### 2. 站点地图
```typescript
GET /sitemap.xml
```

### 3. RSS 订阅
```typescript
GET /feed.xml
GET /feed.json
```

## 🛡️ 错误处理

### 标准错误响应格式
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

### 常见错误码
- `AUTH_REQUIRED` - 需要认证
- `AUTH_INVALID` - 认证失败
- `FORBIDDEN` - 权限不足
- `NOT_FOUND` - 资源不存在
- `VALIDATION_ERROR` - 参数验证失败
- `RATE_LIMIT_EXCEEDED` - 请求频率超限
- `AI_SERVICE_ERROR` - AI 服务错误
- `NETWORK_ERROR` - 网络请求失败

## 📊 API 性能和限制

### 请求频率限制
- 公开 API：50 请求/分钟
- 认证 API：300 请求/分钟
- 管理员 API：500 请求/分钟

### 分页限制
- 默认页大小：20
- 最大页大小：100
- 最大查询深度：1000 条

### 缓存策略
- 链接列表：5分钟缓存
- 搜索结果：10分钟缓存
- 统计信息：1小时缓存
- 设置信息：直到更新

## 🔧 开发和调试

### API 文档
- Swagger/OpenAPI 文档：`/api/docs`
- API 版本信息：`/api/version`

### 调试模式
- 详细错误信息
- 请求/响应日志
- 性能分析数据