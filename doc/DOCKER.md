# Magpie Docker 开发指南

## 🚀 快速开始

Magpie 提供了便捷的 pnpm 脚本来管理 Docker 容器的构建和运行。

### 基本用法

```bash
# 构建 Docker 镜像
pnpm docker:build

# 启动容器（使用默认配置）
pnpm docker:run

# 或者直接使用脚本
scripts/run-docker.sh build
scripts/run-docker.sh start
```

### 传递环境变量

你可以通过环境变量来配置 Docker 容器：

```bash
# 设置 JWT 密钥和 OpenAI API Key
JWT_SECRET="your-secret-key" OPENAI_API_KEY="sk-your-api-key" pnpm docker:run

# 自定义端口和数据目录
PORT=8080 DATA_DIR="./custom-data" pnpm docker:run

# 完整配置示例
JWT_SECRET="my-secret" \
PORT=3001 \
BASE_URL="https://link.mydomain.com" \
pnpm docker:run
```

## 📋 可用的 pnpm 命令

| 命令 | 功能 | 等价脚本命令 |
|------|------|------------|
| `pnpm docker:build` | 构建 Docker 镜像 | `scripts/run-docker.sh build` |
| `pnpm docker:run` | 启动容器 | `scripts/run-docker.sh start` |

## 🛠️ 脚本命令总览

除了 pnpm 命令，你也可以直接使用脚本获得完整功能：

```bash
# 基本操作
scripts/run-docker.sh start    # 启动容器
scripts/run-docker.sh stop     # 停止容器  
scripts/run-docker.sh restart  # 重启容器
scripts/run-docker.sh status   # 查看状态
scripts/run-docker.sh logs     # 查看日志
scripts/run-docker.sh clean    # 删除容器
scripts/run-docker.sh build    # 构建镜像
scripts/run-docker.sh help     # 显示帮助

# 带参数启动
scripts/run-docker.sh start -p 8080 -s "my-secret-key"
```

## ⚙️ 环境变量配置

### 必需配置

| 变量 | 说明 | 示例 |
|------|------|------|
| `JWT_SECRET` | JWT 签名密钥（强烈建议设置） | `"your-super-secret-key"` |

### 可选配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 容器端口映射 | `3001` |
| `DATA_DIR` | 数据目录 | `./data` |
| `BASE_URL` | 应用访问地址 | `http://localhost:PORT` |
| `CONTAINER_NAME` | 容器名称 | `magpie` |
| `IMAGE_TAG` | Docker 镜像标签 | `latest` |

### AI 功能配置

| 变量 | 说明 | 示例 |
|------|------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥 | `"sk-your-api-key"` |
| `OPENAI_BASE_URL` | OpenAI API 基础地址 | `"https://api.openai.com/v1"` |

这些配置是完全可以选的，可以在容器启动后通过 Admin 页面修改。

## 📁 数据持久化

容器会自动创建数据目录并持久化以下数据：

```bash
./data/                    # 默认数据目录
└── magpie.db             # SQLite 数据库文件
```

**重要说明**：
- 数据库使用 `DELETE` 日志模式和 `FULL` 同步模式确保容器环境下的数据完整性
- 所有数据修改都会立即写入磁盘，避免容器重启时数据丢失

## 🔧 开发工作流

### 典型开发流程

```bash
# 1. 修改代码后构建新镜像
pnpm docker:build

# 2. 停止现有容器（如果运行中）
scripts/run-docker.sh stop

# 3. 启动新容器
JWT_SECRET="dev-secret" OPENAI_API_KEY="sk-xxx" pnpm docker:run

# 4. 查看应用状态
scripts/run-docker.sh status

# 5. 查看日志（如需调试）
scripts/run-docker.sh logs
```

### 快速重启

```bash
# 重启容器（保持现有配置）
scripts/run-docker.sh restart
```

## 📊 镜像信息

- **镜像大小**: ~238MB
- **基础镜像**: `node:22-alpine`  
- **构建方式**: 多阶段构建
- **包含内容**:
  - Node.js 22 运行时
  - 编译后的前端和后端应用
  - 生产依赖
  - SQLite 数据库支持
  - 静态文件服务

## 🛠️ 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 查看端口占用
   lsof -i :3001
   
   # 使用不同端口
   PORT=8080 pnpm docker:run
   ```

2. **权限问题**
   ```bash
   # 确保脚本可执行
   chmod +x scripts/run-docker.sh
   
   # 确保数据目录可写
   mkdir -p ./data
   chmod 755 ./data
   ```

3. **容器启动失败**
   ```bash
   # 查看详细日志
   scripts/run-docker.sh logs
   
   # 或直接查看 Docker 日志
   docker logs magpie
   ```

4. **镜像不存在**
   ```bash
   # 构建镜像
   pnpm docker:build
   ```

### 健康检查

访问以下端点检查服务状态：

- **健康检查**: `http://localhost:3001/api/health`
- **主页**: `http://localhost:3001/`

## 🔐 生产部署建议

### 1. 安全配置

```bash
# 生成强 JWT 密钥
export JWT_SECRET="$(openssl rand -base64 32)"

# 启动容器
JWT_SECRET="$JWT_SECRET" \
BASE_URL="https://your-domain.com" \
pnpm docker:run
```

### 2. 反向代理配置

**Nginx 示例**:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. 数据备份

```bash
# 定期备份数据库
cp ./data/magpie.db ./backup/magpie-$(date +%Y%m%d).db
```

### 4. 日志管理

```bash
# 设置 Docker 日志轮转
docker run --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 ...
```

## 🔄 更新升级

```bash
# 停止现有容器
scripts/run-docker.sh stop

# 拉取最新代码
git pull

# 重新构建镜像
pnpm docker:build

# 启动新容器（使用相同配置）
JWT_SECRET="your-secret" pnpm docker:run
```

---

**提示**: 推荐在生产环境中使用环境变量来管理配置，避免将敏感信息硬编码在脚本中。