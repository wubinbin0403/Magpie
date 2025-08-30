# Magpie 数据库设计文档

## 🗄️ 数据库概述

### 数据库类型
- **SQLite**：轻量级、自包含、零配置
- **版本**：SQLite 3.35+ (支持 FTS5 全文搜索)
- **文件位置**：`/data/magpie.db`

### 设计原则
- **简洁性**：最小化表数量，避免过度设计
- **性能优化**：合理的索引设计
- **扩展性**：预留扩展字段，支持未来功能
- **数据完整性**：适当的约束和外键关系

## 📋 数据需求分析

基于 API 设计和前端功能需求，我们需要存储以下数据：

### 核心数据
- **链接信息**：URL、标题、描述、分类、标签
- **AI 处理结果**：原始内容、AI 摘要、AI 建议
- **用户确认内容**：最终描述、分类、标签
- **状态管理**：待确认、已发布、已删除
- **元数据**：创建时间、发布时间、域名信息

### 系统配置
- **应用设置**：站点信息、显示配置
- **AI 配置**：API 密钥、模型参数、提示模板
- **认证信息**：API Tokens、管理员密码

### 统计和日志
- **操作日志**：用户操作记录、系统事件
- **搜索日志**：搜索关键词、结果统计
- **使用统计**：访问量、热门内容

## 🏗️ 表结构设计

### 1. links（链接主表）

存储所有链接的完整信息，是系统的核心数据表。

```sql
CREATE TABLE links (
  -- 主键和基本信息
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,                     -- 链接URL，允许重复收藏
  domain TEXT NOT NULL,                  -- 域名，从URL提取
  
  -- 内容信息
  title TEXT,                           -- 页面标题
  originalDescription TEXT,             -- 网页原始描述
  originalContent TEXT,                 -- 网页原始内容（用于AI分析）
  
  -- AI 处理结果
  aiSummary TEXT,                      -- AI 生成的摘要
  aiCategory TEXT,                     -- AI 建议的分类
  aiTags TEXT,                         -- AI 建议的标签（JSON数组）
  
  -- 用户确认内容
  userDescription TEXT,                -- 用户最终确认的描述
  userCategory TEXT,                   -- 用户选择的分类
  userTags TEXT,                      -- 用户选择的标签（JSON数组）
  
  -- 最终展示内容（冗余字段，优化查询性能）
  finalDescription TEXT,              -- 最终描述（userDescription 或 aiSummary）
  finalCategory TEXT,                 -- 最终分类（userCategory 或 aiCategory）
  finalTags TEXT,                     -- 最终标签（JSON数组）
  
  -- 元数据
  status TEXT DEFAULT 'pending',       -- pending|published|deleted
  clickCount INTEGER DEFAULT 0,        -- 链接点击次数
  
  -- 时间戳
  createdAt INTEGER NOT NULL,         -- 创建时间（Unix时间戳）
  updatedAt INTEGER,                  -- 更新时间
  publishedAt INTEGER,                -- 发布时间
  
  -- 搜索优化
  searchText TEXT,                    -- 预处理的搜索文本
  
  -- 约束
  CHECK (status IN ('pending', 'published', 'deleted')),
  CHECK (createdAt > 0)
);
```

### 2. settings（系统设置表）

存储系统配置信息的键值对表。

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,               -- 设置键名
  value TEXT,                        -- 设置值（JSON格式）
  type TEXT DEFAULT 'string',        -- 值类型：string|number|boolean|json
  description TEXT,                  -- 设置描述
  
  -- 时间戳
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  
  -- 约束
  CHECK (type IN ('string', 'number', 'boolean', 'json'))
);
```

**预设的设置项：**
```sql
-- 站点基本信息
INSERT INTO settings VALUES ('site_title', 'Magpie', 'string', '站点标题', strftime('%s', 'now'), strftime('%s', 'now'));
INSERT INTO settings VALUES ('site_description', '收集和分享有趣的链接', 'string', '站点描述', strftime('%s', 'now'), strftime('%s', 'now'));
INSERT INTO settings VALUES ('about_url', '', 'string', '关于页面URL', strftime('%s', 'now'), strftime('%s', 'now'));

-- AI 服务配置
INSERT INTO settings VALUES ('openai_api_key', '', 'string', 'OpenAI API密钥', strftime('%s', 'now'), strftime('%s', 'now'));
INSERT INTO settings VALUES ('openai_base_url', 'https://api.openai.com/v1', 'string', 'OpenAI API基础URL', strftime('%s', 'now'), strftime('%s', 'now'));
INSERT INTO settings VALUES ('ai_model', 'gpt-3.5-turbo', 'string', 'AI模型名称', strftime('%s', 'now'), strftime('%s', 'now'));
INSERT INTO settings VALUES ('ai_temperature', '0.7', 'number', 'AI温度参数', strftime('%s', 'now'), strftime('%s', 'now'));

-- Prompt 模板
INSERT INTO settings VALUES ('ai_summary_prompt', '请分析以下网页内容，生成50字以内的中文摘要：\n\n标题：{title}\nURL：{url}\n内容：{content}\n\n要求：\n1. 简洁明了，突出核心观点\n2. 50字以内\n3. 使用中文', 'string', 'AI摘要生成提示词', strftime('%s', 'now'), strftime('%s', 'now'));
INSERT INTO settings VALUES ('ai_category_prompt', '基于内容，从以下分类中选择最合适的1个：{categories}\n\n如果都不合适，可以建议新分类。', 'string', 'AI分类提示词', strftime('%s', 'now'), strftime('%s', 'now'));

-- 内容设置
INSERT INTO settings VALUES ('default_category', '其他', 'string', '默认分类', strftime('%s', 'now'), strftime('%s', 'now'));
INSERT INTO settings VALUES ('categories', '["技术", "设计", "产品", "工具", "其他"]', 'json', '可用分类列表', strftime('%s', 'now'), strftime('%s', 'now'));
INSERT INTO settings VALUES ('items_per_page', '20', 'number', '每页显示数量', strftime('%s', 'now'), strftime('%s', 'now'));

-- 系统配置
INSERT INTO settings VALUES ('max_content_length', '10000', 'number', '最大内容长度', strftime('%s', 'now'), strftime('%s', 'now'));
INSERT INTO settings VALUES ('rate_limit_per_minute', '50', 'number', '每分钟请求限制', strftime('%s', 'now'), strftime('%s', 'now'));
```

### 3. api_tokens（API令牌表）

管理API访问令牌，支持多token和权限控制。

```sql
CREATE TABLE api_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Token信息
  token TEXT UNIQUE NOT NULL,         -- Token值（加密存储）
  name TEXT,                         -- Token名称/备注
  prefix TEXT,                       -- Token前缀（如 mgp_）
  
  -- 权限和状态
  status TEXT DEFAULT 'active',       -- active|revoked
  
  -- 使用统计
  usageCount INTEGER DEFAULT 0,      -- 使用次数
  lastUsedAt INTEGER,                -- 最后使用时间
  lastUsedIp TEXT,                   -- 最后使用IP
  
  -- 时间管理
  createdAt INTEGER NOT NULL,
  revokedAt INTEGER,                 -- 撤销时间
  
  -- 约束
  CHECK (status IN ('active', 'revoked')),
  CHECK (createdAt > 0)
);
```

### 4. users（管理员用户表）

存储管理员账户信息，支持基于密码的登录认证。

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- 账户信息
  username TEXT UNIQUE NOT NULL,      -- 用户名
  passwordHash TEXT NOT NULL,         -- 密码哈希（bcrypt）
  salt TEXT NOT NULL,                 -- 密码盐值
  
  -- 用户信息
  email TEXT,                         -- 邮箱（可选）
  displayName TEXT,                   -- 显示名称
  
  -- 权限和状态
  role TEXT DEFAULT 'admin',          -- admin（暂时只有管理员角色）
  status TEXT DEFAULT 'active',       -- active|suspended|deleted
  
  -- 登录相关
  lastLoginAt INTEGER,                -- 最后登录时间
  lastLoginIp TEXT,                   -- 最后登录IP
  loginAttempts INTEGER DEFAULT 0,    -- 登录尝试次数（防暴力破解）
  lockedUntil INTEGER,                -- 锁定到期时间
  
  -- Session 管理
  sessionToken TEXT,                  -- 当前会话token
  sessionExpiresAt INTEGER,           -- 会话过期时间
  
  -- 时间戳
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER,
  
  -- 约束
  CHECK (role IN ('admin')),
  CHECK (status IN ('active', 'suspended', 'deleted')),
  CHECK (createdAt > 0)
);
```

### 5. operation_logs（操作日志表）

记录系统操作日志，用于审计和统计。

```sql
CREATE TABLE operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- 操作信息
  action TEXT NOT NULL,              -- 操作类型：link_add|link_publish|link_delete|token_create等
  resource TEXT,                     -- 操作资源：links|settings|tokens
  resourceId INTEGER,                -- 资源ID
  
  -- 操作详情
  details TEXT,                      -- 操作详情（JSON格式）
  status TEXT DEFAULT 'success',     -- success|failed|pending
  errorMessage TEXT,                 -- 错误信息
  
  -- 请求信息
  userAgent TEXT,                    -- User Agent
  ip TEXT,                          -- 客户端IP
  tokenId INTEGER,                   -- 使用的Token ID（API调用）
  userId INTEGER,                    -- 用户ID（管理员操作）
  
  -- 性能信息
  duration INTEGER,                  -- 操作耗时（毫秒）
  
  -- 时间戳
  createdAt INTEGER NOT NULL,
  
  -- 外键
  FOREIGN KEY (tokenId) REFERENCES api_tokens(id),
  FOREIGN KEY (userId) REFERENCES users(id),
  
  -- 约束
  CHECK (status IN ('success', 'failed', 'pending')),
  CHECK (createdAt > 0)
);
```

### 6. search_logs（搜索日志表）

记录搜索行为，用于搜索优化和统计分析。

```sql
CREATE TABLE search_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- 搜索信息
  query TEXT NOT NULL,              -- 搜索关键词
  normalizedQuery TEXT,             -- 标准化后的查询
  resultsCount INTEGER,             -- 搜索结果数量
  responseTime INTEGER,             -- 响应时间（毫秒）
  
  -- 筛选条件
  filters TEXT,                     -- 筛选条件（JSON格式）
  sortBy TEXT,                      -- 排序方式
  
  -- 用户行为
  clickedResults TEXT,              -- 点击的结果ID列表（JSON数组）
  noResultsFound BOOLEAN DEFAULT 0, -- 是否无结果
  
  -- 请求信息
  ip TEXT,
  userAgent TEXT,
  
  -- 时间戳
  createdAt INTEGER NOT NULL,
  
  -- 约束
  CHECK (createdAt > 0),
  CHECK (resultsCount >= 0)
);
```

### 7. categories（分类表）- 可选

如果需要更复杂的分类管理，可以单独建表。目前暂时使用 settings 表的 JSON 配置。

```sql
-- 暂时不实现，使用 settings 表的 categories 配置
-- 未来如果需要分类层级、描述等复杂功能时再考虑
```

## 🔍 全文搜索支持

### FTS5 虚拟表

为了支持高效的全文搜索，创建 FTS5 虚拟表：

```sql
-- 创建全文搜索虚拟表
CREATE VIRTUAL TABLE links_fts USING fts5(
  title,                            -- 标题
  finalDescription,                 -- 描述
  finalTags,                        -- 标签
  domain,                          -- 域名
  finalCategory,                   -- 分类
  content=links,                   -- 关联到 links 表
  content_rowid=id                 -- 使用 links 表的 id 作为 rowid
);

-- 创建触发器，自动同步数据到 FTS5 表
CREATE TRIGGER links_fts_insert AFTER INSERT ON links BEGIN
  INSERT INTO links_fts(rowid, title, finalDescription, finalTags, domain, finalCategory)
  VALUES (NEW.id, NEW.title, NEW.finalDescription, NEW.finalTags, NEW.domain, NEW.finalCategory);
END;

CREATE TRIGGER links_fts_delete AFTER DELETE ON links BEGIN
  INSERT INTO links_fts(links_fts, rowid, title, finalDescription, finalTags, domain, finalCategory)
  VALUES ('delete', OLD.id, OLD.title, OLD.finalDescription, OLD.finalTags, OLD.domain, OLD.finalCategory);
END;

CREATE TRIGGER links_fts_update AFTER UPDATE ON links BEGIN
  INSERT INTO links_fts(links_fts, rowid, title, finalDescription, finalTags, domain, finalCategory)
  VALUES ('delete', OLD.id, OLD.title, OLD.finalDescription, OLD.finalTags, OLD.domain, OLD.finalCategory);
  INSERT INTO links_fts(rowid, title, finalDescription, finalTags, domain, finalCategory)
  VALUES (NEW.id, NEW.title, NEW.finalDescription, NEW.finalTags, NEW.domain, NEW.finalCategory);
END;
```

## 🚀 索引设计

### 主要索引

```sql
-- links 表索引
CREATE INDEX idx_links_status ON links(status);
CREATE INDEX idx_links_domain ON links(domain);
CREATE INDEX idx_links_category ON links(finalCategory);
CREATE INDEX idx_links_published_at ON links(publishedAt DESC);
CREATE INDEX idx_links_created_at ON links(createdAt DESC);
CREATE INDEX idx_links_status_published_at ON links(status, publishedAt DESC);

-- 复合索引，优化常用查询
CREATE INDEX idx_links_status_category_published ON links(status, finalCategory, publishedAt DESC);

-- users 表索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_session_token ON users(sessionToken);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_last_login ON users(lastLoginAt DESC);

-- api_tokens 表索引
CREATE INDEX idx_tokens_status ON api_tokens(status);
CREATE INDEX idx_tokens_last_used ON api_tokens(lastUsedAt DESC);

-- operation_logs 表索引
CREATE INDEX idx_logs_created_at ON operation_logs(createdAt DESC);
CREATE INDEX idx_logs_action ON operation_logs(action);
CREATE INDEX idx_logs_resource ON operation_logs(resource, resourceId);
CREATE INDEX idx_logs_user_id ON operation_logs(userId);
CREATE INDEX idx_logs_token_id ON operation_logs(tokenId);

-- search_logs 表索引
CREATE INDEX idx_search_query ON search_logs(query);
CREATE INDEX idx_search_created_at ON search_logs(createdAt DESC);
CREATE INDEX idx_search_no_results ON search_logs(noResultsFound);
```

## 📊 实时统计查询

系统采用实时查询而非预计算视图，确保数据的即时性和准确性。常用的统计查询示例：

```sql
-- 分类统计（实时查询）
SELECT 
  finalCategory as category,
  COUNT(*) as count,
  MAX(publishedAt) as lastPublished
FROM links 
WHERE status = 'published' 
GROUP BY finalCategory
ORDER BY count DESC;

-- 域名统计（实时查询）
SELECT 
  domain,
  COUNT(*) as count,
  MAX(publishedAt) as lastPublished
FROM links 
WHERE status = 'published' 
GROUP BY domain
ORDER BY count DESC;

-- 月度统计（实时查询）
SELECT 
  strftime('%Y-%m', publishedAt, 'unixepoch') as month,
  COUNT(*) as count,
  COUNT(DISTINCT finalCategory) as categories,
  COUNT(DISTINCT domain) as domains
FROM links 
WHERE status = 'published' 
GROUP BY month
ORDER BY month DESC;

-- 标签使用统计（实时查询）
SELECT 
  json_each.value as tag,
  COUNT(*) as count
FROM links, json_each(links.finalTags)
WHERE links.status = 'published'
GROUP BY json_each.value
ORDER BY count DESC;
```

这些查询在需要时直接执行，利用合理的索引设计保证查询性能。

## 🔧 数据库初始化

### 初始化脚本结构

```sql
-- 1. 创建主要表
-- (见上面的表结构定义)

-- 2. 创建索引
-- (见上面的索引定义)

-- 3. 实时查询（不创建视图）
-- (见上面的实时查询示例，按需执行)

-- 4. 创建 FTS5 搜索表
-- (见上面的全文搜索定义)

-- 5. 插入默认设置
-- (见 settings 表的默认数据)

-- 6. 创建第一个管理员 Token
INSERT INTO api_tokens (token, name, createdAt)
VALUES ('mgp_' || hex(randomblob(32)), 'Initial Admin Token', strftime('%s', 'now'));

-- 7. 创建默认管理员用户（需要应用程序处理密码哈希）
-- 这部分通过 /api/admin/init 接口处理，不在SQL中硬编码
```

## 📈 性能优化建议

### 1. 查询优化
- 使用复合索引覆盖常用的多字段查询
- 避免在大字段上建立索引（如 originalContent）
- 合理使用 LIMIT 和 OFFSET 进行分页

### 2. 存储优化
- JSON 字段用于非查询的数组数据（如 tags）
- 冗余设计：finalXxx 字段避免复杂的 CASE WHEN 查询
- 定期清理过期的日志数据

### 3. 全文搜索优化
- 使用 FTS5 的高级查询语法
- 定期执行 `INSERT INTO links_fts(links_fts) VALUES('optimize')`
- 考虑为中文搜索添加分词支持

### 4. 维护任务
- 定期 VACUUM 优化数据库
- 分析表统计信息：`ANALYZE`
- 清理过期日志和无用数据

## 🔄 数据迁移策略

### 版本控制
- 使用数据库版本号管理 schema 变更
- 在 settings 表中存储当前版本

```sql
INSERT INTO settings VALUES ('db_version', '1.0.0', 'string', '数据库版本', strftime('%s', 'now'), strftime('%s', 'now'));
```

### 迁移脚本示例
```sql
-- 检查版本并执行相应迁移
-- 这部分由应用程序代码处理，确保数据库结构的兼容性
```

## 📋 总结

这个数据库设计支持了 API 的所有功能需求，同时保持了简洁性和高性能。主要特点包括：

### 核心表设计
1. **links 表**：链接主表，支持完整的收藏和处理流程
2. **settings 表**：系统配置，键值对存储各种设置
3. **api_tokens 表**：API 访问控制，支持多 token 管理
4. **users 表**：管理员账户，支持基于密码的认证
5. **operation_logs 表**：操作审计，完整记录系统活动
6. **search_logs 表**：搜索统计，用于功能优化

### 核心特性
1. **用户认证完整**：支持管理员密码登录 + API Token 认证
2. **搜索性能优化**：FTS5 全文搜索 + 合理索引设计  
3. **统计功能丰富**：日志记录 + 实时查询 + 操作审计
4. **扩展性良好**：预留字段 + 灵活的设置系统
5. **运维友好**：完整的日志记录 + 性能监控
6. **安全考虑**：密码哈希 + 会话管理 + 暴力破解防护

### 安全特性
- 密码使用 bcrypt 哈希 + 随机盐值存储
- Session token 管理，支持过期时间
- 登录失败次数限制，防止暴力破解
- 完整的操作审计日志，记录 IP 和 User Agent
- API Token 和用户登录双重认证机制