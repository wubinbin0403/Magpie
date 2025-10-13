# Magpie - 轻量级链接收藏系统

Magpie 是一个轻量级的链接收藏和展示系统，用于收集阅读过程中遇到的有趣链接。结合 AI 自动分析和用户确认流程，支持 Docker 自托管部署。

我的个人链接收集站 https://onevcat.link 就是一个运行中的 Magpie 示例。

## ✨ 主要功能

### 🔗 链接管理
- **智能收集**：通过浏览器扩展或 API 快速收藏链接
- **AI 分析**：自动提取标题、描述、分类和标签
- **分类管理**：支持自定义分类和预设图标
- **标签系统**：多标签管理，支持标签筛选
- **搜索功能**：全文搜索，支持关键词高亮

### 🎯 展示功能
- **响应式设计**：适配桌面和移动设备
- **分类浏览**：按分类筛选链接
- **时间线视图**：按时间顺序展示链接
- **阅读时间**：自动计算并显示预估阅读时间

### 🔧 管理功能
- **后台管理**：完整的后台管理系统
- **链接审批**：支持人工确认或自动发布
- **分类管理**：拖拽排序，自定义图标
- **API Token**：支持多 Token 管理
- **操作日志**：完整的操作审计

### 🌐 扩展支持
- **Chrome 扩展**：一键收藏当前页面
- **API 接口**：RESTful API 支持
- **SEO 优化**：自动生成 sitemap 和 RSS feed

## 🚀 快速开始

### 使用 Docker 部署（推荐）

#### 1. 准备工作
确保系统已安装 Docker。

#### 2. 拉取最新镜像
```bash
docker pull ghcr.io/onevcat/magpie:latest
```

#### 3. 启动容器
```bash
# 使用默认配置启动
docker run -d \
  --name magpie \
  --restart unless-stopped \
  -p 3001:3001 \
  -v ./data:/app/data \
  -e JWT_SECRET="your-super-secret-key" \
  -e BASE_URL="http://localhost:3001" \
  -e NODE_ENV=production \
  ghcr.io/onevcat/magpie:latest
```

#### 4. 访问应用并设置管理员密码
打开浏览器访问：`http://localhost:3001/admin`

### 完整部署示例

```bash
# 1. 创建数据目录
mkdir -p ./data

# 2. 生成强密码 JWT 密钥
export JWT_SECRET=$(openssl rand -base64 32)

# 3. 拉取最新镜像
docker pull ghcr.io/onevcat/magpie:latest

# 4. 启动容器（带 OpenAI 支持）
docker run -d \
  --name magpie \
  --restart unless-stopped \
  -p 3001:3001 \
  -v ./data:/app/data \
  -e JWT_SECRET="$JWT_SECRET" \
  -e OPENAI_API_KEY="sk-your-actual-openai-key" \
  -e BASE_URL="https://links.yourdomain.com" \
  -e NODE_ENV=production \
  ghcr.io/onevcat/magpie:latest

# 5. 查看容器状态
docker ps | grep magpie
```

### 环境变量配置

| 变量 | 说明 | 默认值 | 必需 |
|------|------|--------|------|
| `JWT_SECRET` | JWT 签名密钥 | - | ✅ |
| `PORT` | 服务端口 | `3001` | ❌ |
| `DATA_DIR` | 数据目录 | `./data` | ❌ |
| `BASE_URL` | 应用访问地址 | `http://localhost:PORT` | ❌ |
| `OPENAI_API_KEY` | OpenAI API 密钥 | - | ❌ |
| `OPENAI_BASE_URL` | OpenAI API 地址 | `https://api.openai.com/v1` | ❌ |

## 📁 项目结构

```
magpie/
├── apps/
│   ├── web/          # React 前端应用
│   └── api/          # Hono.js 后端 API
├── packages/
│   └── shared/       # 共享 TypeScript 类型定义
├── extension/        # Chrome 浏览器扩展
├── data/            # SQLite 数据库挂载点
├── scripts/         # 工具脚本
└── doc/             # 设计文档
```

## 🔧 开发指南

### 本地开发环境

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 运行测试
pnpm test

# 构建项目
pnpm build
```

### 数据库操作

```bash
# 重置数据库（开发环境）
pnpm db:reset

# 生成数据库迁移
pnpm db:generate

# 执行数据库迁移
pnpm db:migrate

# 打开数据库管理界面
pnpm db:studio
```

## 🔌 API 使用

### 认证方式

**API Token**：用于外部调用
   ```bash
   curl -H "Authorization: Bearer mgp_your_api_token" \
        https://your-magpie-instance.com/api/links
   ```

### 主要 API 端点

- `GET /api/links` - 获取链接列表
- `POST /api/links` - 添加新链接
- `GET /api/search` - 搜索链接
- `GET /api/stats` - 获取统计信息
- `GET /api/admin/pending` - 获取待处理链接

## 🛠️ 浏览器扩展

### 安装扩展

1. 构建扩展（用于开发）：
   ```bash
   cd extension
   pnpm build
   ```

2. 在 Chrome 中加载扩展：
   - 打开 `chrome://extensions/`
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择 `extension/dist` 目录

**注意**：扩展也提供预构建版本。请查看发布页面获取最新版本。

### 配置扩展

1. 点击扩展图标
2. 输入 Magpie 实例的 URL（如 `http://localhost:3001`）
3. 输入 API Token
4. 点击"测试连接"确认配置正确

## 📊 数据持久化

容器会自动创建数据目录并持久化以下数据：

```
./data/
├── magpie.db             # SQLite 数据库
├── logs/                 # 日志文件
│   ├── error.log         # 错误日志
│   └── combined.log      # 完整日志
└── ...
```

## 🔒 安全建议

1. **设置强 JWT 密钥**：生产环境必须设置
2. **使用 HTTPS**：生产环境启用 HTTPS
3. **定期备份**：定期备份数据库文件
4. **监控日志**：监控应用日志和错误
5. **更新及时**：保持系统和依赖更新

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建特性分支：`git checkout -b feature/AmazingFeature`
3. 提交更改：`git commit -m 'Add some AmazingFeature'`
4. 推送分支：`git push origin feature/AmazingFeature`
5. 提交 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 免责

本项目仅为个人业余兴趣的 Vibe Coding 学习项目，请谨慎将它用于生产环境。本人无法对项目质量进行任何形式的保障和有效支持。

---

**提示**：
- 架设后**请务必**访问管理后台并设置管理员密码
- 建议在生产环境中使用反向代理（如 Nginx）
- 定期备份数据库文件以防数据丢失