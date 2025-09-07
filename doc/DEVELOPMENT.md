# Magpie 开发文档

Magpie 是一个轻博客系统，用于收集和展示在阅读过程中遇到的有趣的链接和内容。

## 🎯 项目概述

### 核心功能
- 一键收藏网页链接（通过浏览器扩展）
- AI 自动生成摘要和分类
- 用户确认编辑流程
- 响应式 Web 展示界面
- 管理后台

### 设计目标
- **极简部署**：Docker 一键启动
- **灵活使用**：支持手动确认和自动化模式
- **数据自控**：SQLite 本地存储，易备份
- **开源友好**：清晰的代码结构，易于扩展

## 🛠 技术栈

### 前端
- **框架**：Vite + React + TypeScript
- **UI 组件**：DaisyUI (基于 Tailwind CSS)
- **状态管理**：TanStack Query
- **路由**：React Router

### 后端
- **Web 框架**：Hono.js (轻量级)
- **ORM**：Drizzle (TypeScript 友好)
- **数据库**：SQLite
- **网页抓取**：Mozilla Readability (替换了 Cheerio，提供更好的内容提取)
- **AI 服务**：OpenAI API 兼容接口

### 部署
- **容器化**：Docker 单容器部署
- **架构**：前后端同容器，静态文件 + API 服务

### 浏览器扩展
- **状态**：计划中，将在后续版本实现
- **标准**：Chrome Extension Manifest V3
- **功能**：一键保存当前页面

## 🏗 系统架构

```
┌─────────────────┐
│  外部API调用     │ ──────► GET /api/links/add?url=xxx
└─────────────────┘         
                            
┌─────────────────────────────────────────────┐
│             Docker 容器                       │
│                                              │
│  ┌─────────────┐        ┌──────────────┐   │
│  │  前端(React) │◄──────►│  API(Hono)    │   │
│  │  端口:3000   │        │  端口:3001    │   │
│  └─────────────┘        └──────────────┘   │
│                               │             │
│                         ┌──────────────┐   │
│                         │   SQLite     │   │
│                         └──────────────┘   │
└─────────────────────────────────────────────┘
```

## 🔄 用户流程

### 标准流程（带确认）
```
API调用 → GET /api/links/add?url=xxx 
→ 显示处理进度 → 302跳转到 /confirm/:id 
→ 编辑确认 → 发布到主页
```

### 自动化流程（跳过确认）
```
API调用 /api/links/add?url=xxx&skipConfirm=true
→ 直接保存并发布 → 返回JSON结果
```

## 📄 页面路由

### 公开页面
- `/` - 主页，React SPA展示已发布链接，爬虫获得静态HTML (参考 `doc/PAGE_MAIN.md`)
  - 主页上可以对 category 进行过滤
- `/search` - 搜索页面，React SPA (参考 `doc/PAGE_SEARCH.md`)

### 认证流程页面
- `/api/links/add` - 处理页面（显示进度，然后跳转）
- `/confirm/:id` - 确认编辑页面

### 管理页面
- `/admin/login` - 管理员登录页面，React SPA
- `/admin` - 管理面板，React SPA（需要用户认证）
- `/admin/settings` - 系统设置
- `/admin/pending` - 待确认列表
- `/admin/tokens` - API Token 管理
- `/admin/ai-settings` - AI 服务设置

### 特殊页面
- `/404` - 页面不存在
- `/500` - 服务器错误

管理页面详细设计参考 `doc/PAGE_ADMIN.md`。

## 🎯 SEO 和渲染策略

为了平衡 SEO 需求和用户体验，Magpie 采用**混合渲染策略**：

### 页面渲染类型
- **主页 (`/`)**：SSR + Hydration - 服务端渲染首屏（SEO友好），然后React接管交互
- **搜索页 (`/search`)**：React SPA - 实时搜索和筛选功能
- **管理页面 (`/admin/*`)**：React SPA - 复杂的管理界面
- **确认页面 (`/confirm/*`)**：React SPA - 编辑功能

### 关键特性
- **爬虫友好**：主页返回完整HTML内容，包含Meta标签和结构化数据
- **用户体验**：支持"加载更多"、实时搜索等现代交互功能
- **性能优化**：首屏快速显示，后续内容按需加载
- **SEO优化**：自动生成Sitemap、RSS Feed、robots.txt

详细的SEO实现方案请参考 `doc/SEO.md`。

## 🔌 API 设计

后端设计详情参考 `doc/API_DESIGN.md`

### 核心端点
```typescript
// 链接管理
GET    /api/links           # 获取链接列表（分页、筛选）
GET    /api/search          # 搜索链接
POST   /api/links/add       # 添加新链接（返回HTML或JSON）
POST   /api/links/:id/confirm # 确认发布
DELETE /api/links/:id       # 删除链接

// 设置管理
GET    /api/admin/settings     # 获取设置
PUT    /api/admin/settings     # 更新设置
```

### API 参数
- `skipConfirm=true` - 跳过用户确认，直接发布
- `category` - 指定分类
- `tags` - 指定标签（逗号分隔）

## 🗄 数据模型

### links 表
```sql
CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,              -- 移除 UNIQUE 约束，允许重复收藏
  domain TEXT NOT NULL,           -- 域名，从URL提取
  title TEXT,
  originalDescription TEXT,       -- 网页原始描述
  aiSummary TEXT,                -- AI 生成摘要
  userDescription TEXT,          -- 用户最终确认的描述
  finalDescription TEXT,         -- 最终展示描述
  finalCategory TEXT,            -- 最终展示分类
  finalTags TEXT,                -- 最终展示标签（JSON数组）
  status TEXT DEFAULT 'pending', -- pending|published|deleted
  clickCount INTEGER DEFAULT 0,  -- 点击统计
  createdAt INTEGER,
  publishedAt INTEGER
);
```

### settings 表
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

#### 设置项
- `api_token` - API 访问令牌
- `openai_api_key` - OpenAI API 密钥
- `openai_base_url` - OpenAI API 基础 URL
- `ai_user_instructions` - 用户补充指令（注入到固定AI模板）
- `categories` - 可用分类列表（JSON）

## 🎨 界面设计

### 主页面
- 时间线布局
- 卡片式展示链接
- 支持分类筛选
- 支持标签筛选
- 搜索功能

### 确认编辑页面
- **左侧**：原始内容预览
- **右侧**：编辑表单
  - 标题编辑
  - 描述编辑（预填 AI 建议）
  - 分类选择
  - 标签选择
  - 确认按钮，提交并展示

### 管理页面
- 系统状态概览
- API 配置
- AI 服务设置
- 待确认列表

## ⚙️ 环境配置

### Docker 环境变量
```env
# 可选配置（以app设置为主）
INITIAL_API_TOKEN=your-secret-token

# AI 服务配置
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1

NODE_ENV=production
MAX_CONTENT_LENGTH=10000
AI_MODEL=gpt-3.5-turbo
AI_TEMPERATURE=0.7
```

### Docker Compose 配置
```yaml
version: '3.8'
services:
  magpie:
    build: .
    ports:
      - "3000:3000"  # 前端
      - "3001:3001"  # API
    volumes:
      - ./data:/app/data      # SQLite 数据持久化
      - ./config:/app/config  # 配置文件
    environment:
      - NODE_ENV=production
      - INITIAL_API_TOKEN=${INITIAL_API_TOKEN}
    restart: unless-stopped
```

## 📦 项目结构

```
magpie/
├── apps/
│   ├── web/                 # React 前端
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   └── utils/
│   │   └── package.json
│   └── api/                 # Hono 后端
│       ├── src/
│       │   ├── routes/
│       │   ├── db/
│       │   ├── services/
│       │   └── utils/
│       └── package.json
├── packages/
│   └── shared/              # 共享类型定义
├── extension/               # Chrome 扩展
│   ├── manifest.json
│   ├── background.js
│   └── popup.html
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── data/                    # SQLite 数据库挂载点
├── doc/                     # 文档
└── README.md
```

## 🚀 部署步骤

### 1. 克隆项目
```bash
git clone https://github.com/username/magpie.git
cd magpie
```

### 2. 配置环境
```bash
cp .env.example .env
# 编辑 .env 文件，设置必要的环境变量
```

### 3. 启动服务
```bash
docker-compose up -d
```

### 4. 配置 API Token
1. 打开管理界面 `http://localhost:3000/admin`
2. 登录后进入 Token 管理页面
3. 创建新的 API Token
4. 使用该 Token 进行 API 调用

### 5. 测试 API
```bash
# 测试添加链接
curl -X GET "http://localhost:3001/api/links/add?url=https://example.com" \
     -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔧 开发指南

### 本地开发环境搭建
```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建项目
pnpm build

# 运行测试
pnpm test
```

### 代码规范
- 使用 TypeScript 严格模式
- ESLint + Prettier 代码格式化
- 组件使用函数式写法
- API 使用 RESTful 设计
- 数据库操作使用 Drizzle ORM

### 类型定义和共享
项目采用 monorepo 架构，所有 API 相关的类型定义统一管理：

- **类型定义位置**：`packages/shared/src/api.ts`
- **包含内容**：
  - API 请求和响应类型（`ApiResponse`, `LinksResponse`, `SearchResponse` 等）
  - 数据模型类型（`Link`, `PendingLink`, `Pagination` 等）
  - 查询参数类型（`LinksQuery`, `SearchQuery` 等）
  - 统计数据类型（`CategoryStats`, `TagStats` 等）

- **使用方式**：
  ```typescript
  // 在前端和后端项目中导入类型
  import type { LinksResponse, ApiResponse, Link } from '@magpie/shared';
  ```

- **依赖配置**：
  - 在 `apps/api/package.json` 和 `apps/web/package.json` 的 `devDependencies` 中添加 `"@magpie/shared": "workspace:*"`
  - TypeScript 路径映射已配置为 `"@magpie/shared/*": ["../../packages/shared/src/*"]`

- **构建要求**：
  - 修改 `packages/shared` 中的类型后，需要运行 `pnpm build` 重新构建
  - 确保前端和后端项目使用一致的类型定义

### 前端 API 调用

项目中前端使用了一个简化的 API 客户端，位于 `apps/web/src/utils/api.ts`。类型安全的 API 客户端虽然已实现（`packages/shared/src/api-client.ts`），但目前**未在实际项目中使用**。

#### 当前使用的前端 API 客户端

```typescript
// 已实现的前端 API 调用方式
import api from '../utils/api'

// 获取链接列表
const response = await api.getLinks({ page: 1, limit: 10 })

// 搜索链接
const searchResult = await api.searchLinks('typescript', { category: 'tech' })

// 管理员登录
const loginResult = await api.adminLogin(password)

// 添加链接
const addResult = await api.addLinkJson(url, { 
  skipConfirm: false,
  category: 'tech'
})
```

#### 未来改进计划

如果需要更完整的类型安全支持，可以考虑将前端迁移到使用 `MagpieApiClient`：

```typescript
// 未来可选的类型安全方式（已实现但未使用）
import { MagpieApiClient } from '@magpie/shared'

const api = new MagpieApiClient('http://localhost:3001', 'your-api-token')
const response = await api.getLinks({ page: 1, limit: 10, category: 'tech' })
```

### Git 工作流
- `master` - 主分支，用于发布
- `develop` - 开发分支
- `feature/*` - 功能分支
- `hotfix/*` - 热修复分支

## 🧪 测试策略

### 单元测试
- React 组件测试（React Testing Library）
- API 端点测试（Hono 测试工具）
- 工具函数测试（Vitest）

## 📈 性能优化

### 前端优化
- 代码分割（React.lazy）
- 图片懒加载
- 虚拟滚动（长列表）
- Service Worker 缓存

### 后端优化
- 数据库索引优化
- API 响应缓存
- 分页查询优化

## 🔒 安全考虑

### 双重认证机制
系统采用双重认证设计，支持不同的使用场景：

**1. 管理员用户认证**（用于 Web 管理界面）
- 基于用户名密码的登录
- Session Token 管理，支持过期时间
- 用于访问 `/admin` 管理页面
- 支持"记住登录"功能

**2. API Token 认证**（用于扩展和外部调用）
- 长期有效的 API Token（`mgp_` 前缀）
- 用于浏览器扩展和外部 API 调用
- 支持不同权限级别：read、write、admin
- 可在管理界面创建和撤销

### 权限级别
- **公开访问**：主页、搜索页面
- **Token 认证**：添加链接、确认操作
- **管理员认证**：系统设置、用户管理

### 其他安全措施
- 请求频率限制
- CORS 配置
- 暴力破解防护（登录失败锁定）

### 数据安全
- 敏感配置加密
- SQL 注入防护（Drizzle ORM）
- XSS 防护
- 文件上传安全

## 📚 参考资源

- [Hono.js 文档](https://hono.dev/)
- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [DaisyUI 组件库](https://daisyui.com/)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/)
- [Docker 最佳实践](https://docs.docker.com/develop/dev-best-practices/)