# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Magpie 是一个轻量级链接收藏和展示系统，用于收集阅读过程中遇到的有趣链接。结合 AI 自动分析和用户确认流程，支持 Docker 自托管部署。

这个项目是一个纯 AI 驱动和 Vibe Coding 优先的项目。项目的开发应该遵循文档：

### 开发文档和特性总览

- `doc/DEVELOPMENT.md`

### 前端页面设计

- `doc/PAGE_MAIN.md` - 主页，链接卡片展示
- `doc/PAGE_SEARCH.md` - 搜索页面，展示满足搜索条件的卡片
- `doc/PAGE_ADMIN.md` - 管理页面，负责配置和批准 pending 的链接

### API 设计

- `doc/API_DESIGN.md`

### 数据库设计

- `doc/DATABASE_DESIGN.md`

**重要**:

- 在计划和编码时，遇到相关任务，**必须**先读取上述文档的内容，并需要严格按照要求进行。
- 如果实际任务中遇到冲突需要变更需求，**必须**告诉开发者并先更新文档内容，然后再进行代码编写。

## 主要技术架构

### 技术栈
- **前端**: Vite + React + TypeScript + DaisyUI (基于 Tailwind CSS)
- **后端**: Hono.js + Drizzle ORM + SQLite
- **AI 集成**: OpenAI API 兼容服务
- **浏览器扩展**: Chrome Extension Manifest V3
- **API 支持**：支持使用任意 HTTP Client 使用 Token 添加链接
- **部署**: Docker 单容器部署（静态文件 + API 服务）

### 项目结构（计划）
```
apps/
├── web/          # React 前端应用
└── api/          # Hono.js 后端 API
packages/
└── shared/       # 共享 TypeScript 类型定义
extension/        # Chrome 浏览器扩展
docker/          # 容器配置
data/            # SQLite 数据库挂载点
doc/             # 完整设计文档
```

## 核心工作流程

### 链接收集流程
```
浏览器扩展或使用API → API 端点 → 网页抓取 → AI 分析 → 用户确认 → 发布展示
```

**两种模式**:
- **标准流程**: 用户可编辑 AI 建议后发布
- **自动化流程**: 使用 AI 建议直接发布（`skipConfirm=true`）

### AI 处理管道
1. 网页内容抓取（Cheerio）
2. 调用 AI API 生成摘要和分类建议
3. 存储 AI 结果和原始内容
4. 用户确认或自动发布

## 开发规范

### 代码标准
- 全项目使用 TypeScript 严格模式
- ESLint + Prettier 代码格式化
- 函数式组件配合 Hooks
- RESTful API 设计原则
- 使用 Drizzle ORM 进行所有数据库操作

### 类型系统和共享
- **类型定义位置**: 所有 API 相关的类型定义统一放在 `packages/shared/src/api.ts` 中
- **类型导入方式**: 前端和后端项目都通过 `import type { ... } from '@magpie/shared'` 导入类型
- **依赖配置**: shared 包作为 `devDependencies` 添加到各项目的 package.json 中
- **构建要求**: 修改 shared 包后需要运行 `pnpm build` 重新构建类型定义文件

### 设计规范
- 在开发前端页面是，遵循最优的设计规范，设计一个简洁优雅的页面
- **图标库**: 使用 heroicons 作为图标库。在需要使用图标时，选择这个图标库，不要尝试自行绘制SVG
- **颜色**：站点定义了主题色和颜色盘。参考 apps/web/tailwind.config.js 下的颜色定义。

## 测试规范和要求

#### 测试框架
本项目使用 **Vitest** 作为统一的测试框架：
- 前端：Vitest + React Testing Library + @testing-library/user-event
- 后端：Vitest + supertest (用于测试 Hono.js API)

### 核心测试原则

1. **测试驱动开发（TDD）**
   - 在实现新功能前，先编写失败的测试
   - 实现功能使测试通过
   - 重构代码时确保测试仍然通过

2. **测试覆盖要求**
   - 每个新功能必须包含相应的测试
   - 修改现有代码时，必须更新相关测试
   - 目标测试覆盖率：关键业务逻辑 > 90%，整体代码 > 80%

3. **提交前验证**
   在提交任何代码更改前，必须：
   - 在 `apps/api` 和/或 `apps/web` 下运行
   - 运行 `pnpm test` 确保所有测试通过

### 安全要求
- 绝不提交 API 密钥或令牌
- 使用 bcrypt 进行密码哈希
- 实施请求频率限制
- 完整的操作审计日志
- 通过 ORM 防止 SQL 注入

## 当前状态

**项目阶段**: 设计文档完成，基本代码实现完成。正在打磨阶段。
**文档状态**: `/doc/` 目录包含涵盖所有方面的完整设计文档
**基本实现**：站点的基本功能已经实现，后续还需要仔细打磨和完成周边功能
**下一步骤**: 开始代码实现，建议从数据库设置和核心 API 端点开始
