#!/bin/bash

# Magpie Docker 运行脚本
# 用于快速启动本地 Docker 容器

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认配置
CONTAINER_NAME="${CONTAINER_NAME:-magpie}"
PORT="${PORT:-3001}"
DATA_DIR="${DATA_DIR:-./data}"
JWT_SECRET="${JWT_SECRET:-}"
BASE_URL="${BASE_URL:-http://localhost:$PORT}"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"
OPENAI_BASE_URL="${OPENAI_BASE_URL:-}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# 版本管理函数
get_version_from_package() {
    if [ -f "package.json" ]; then
        node -p "require('./package.json').version" 2>/dev/null || echo "latest"
    else
        echo "latest"
    fi
}

get_git_info() {
    if git rev-parse --git-dir > /dev/null 2>&1; then
        local branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
        local commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
        echo "${branch}-${commit}"
    else
        echo "nogit"
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
Magpie Docker 运行脚本

使用方法:
    ./run-docker.sh [命令] [选项]

命令:
    start       启动容器 (默认)
    stop        停止容器
    restart     重启容器
    logs        查看日志
    status      查看状态
    clean       停止并删除容器
    build       构建镜像
    help        显示帮助

选项:
    -p, --port PORT           设置端口 (默认: 3001)
    -d, --data-dir DIR        数据目录 (默认: ./data)
    -n, --name NAME           容器名称 (默认: magpie)
    -s, --secret SECRET       JWT密钥
    -k, --api-key KEY         OpenAI API密钥
    -u, --base-url URL        基础URL
    -t, --tag TAG             镜像标签 (默认: latest)

环境变量:
    PORT                      端口号
    DATA_DIR                  数据目录
    JWT_SECRET                JWT密钥
    OPENAI_API_KEY           OpenAI API密钥
    OPENAI_BASE_URL          OpenAI API基础URL
    BASE_URL                  应用基础URL

示例:
    # 基本启动
    ./run-docker.sh start

    # 指定端口和JWT密钥
    ./run-docker.sh start -p 8080 -s "my-secret-key"

    # 使用环境变量
    JWT_SECRET="my-secret" OPENAI_API_KEY="sk-xxx" ./run-docker.sh start

    # 查看日志
    ./run-docker.sh logs

    # 重启容器
    ./run-docker.sh restart
EOF
}

# 解析参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -p|--port)
                PORT="$2"
                BASE_URL="http://localhost:$PORT"
                shift 2
                ;;
            -d|--data-dir)
                DATA_DIR="$2"
                shift 2
                ;;
            -n|--name)
                CONTAINER_NAME="$2"
                shift 2
                ;;
            -s|--secret)
                JWT_SECRET="$2"
                shift 2
                ;;
            -k|--api-key)
                OPENAI_API_KEY="$2"
                shift 2
                ;;
            -u|--base-url)
                BASE_URL="$2"
                shift 2
                ;;
            -t|--tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
}

# 生成随机JWT密钥
generate_jwt_secret() {
    if [ -z "$JWT_SECRET" ]; then
        JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
        echo -e "${YELLOW}⚠️  生成随机 JWT 密钥: $JWT_SECRET${NC}"
        echo -e "${YELLOW}   建议将其保存到环境变量或 .env 文件中${NC}"
    fi
}

# 检查镜像是否存在
check_image() {
    if ! docker image inspect "magpie:$IMAGE_TAG" &>/dev/null; then
        echo -e "${RED}❌ 镜像 magpie:$IMAGE_TAG 不存在${NC}"
        echo -e "${YELLOW}请先运行: ./run-docker.sh build${NC}"
        exit 1
    fi
}

# 启动容器
start_container() {
    echo -e "${BLUE}🚀 启动 Magpie 容器...${NC}"
    
    # 检查镜像
    check_image
    
    # 生成JWT密钥
    generate_jwt_secret
    
    # 检查端口是否被占用
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}❌ 端口 $PORT 已被占用${NC}"
        exit 1
    fi
    
    # 检查容器是否已存在
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${YELLOW}⚠️  容器 $CONTAINER_NAME 已存在，正在停止...${NC}"
        docker stop "$CONTAINER_NAME" >/dev/null 2>&1
        docker rm "$CONTAINER_NAME" >/dev/null 2>&1
    fi
    
    # 创建数据目录
    mkdir -p "$DATA_DIR"
    
    # 构建 docker run 命令
    DOCKER_CMD="docker run -d --name $CONTAINER_NAME"
    DOCKER_CMD="$DOCKER_CMD --restart unless-stopped"
    DOCKER_CMD="$DOCKER_CMD -p $PORT:3001"
    DOCKER_CMD="$DOCKER_CMD -v \"$(pwd)/$DATA_DIR:/app/data\""
    DOCKER_CMD="$DOCKER_CMD -e JWT_SECRET=\"$JWT_SECRET\""
    DOCKER_CMD="$DOCKER_CMD -e BASE_URL=\"$BASE_URL\""
    DOCKER_CMD="$DOCKER_CMD -e NODE_ENV=production"
    
    # 可选的 OpenAI 配置
    if [ -n "$OPENAI_API_KEY" ]; then
        DOCKER_CMD="$DOCKER_CMD -e OPENAI_API_KEY=\"$OPENAI_API_KEY\""
    fi
    
    if [ -n "$OPENAI_BASE_URL" ]; then
        DOCKER_CMD="$DOCKER_CMD -e OPENAI_BASE_URL=\"$OPENAI_BASE_URL\""
    fi
    
    DOCKER_CMD="$DOCKER_CMD magpie:$IMAGE_TAG"
    
    # 执行命令
    eval $DOCKER_CMD
    
    echo -e "${GREEN}✅ 容器启动成功！${NC}"
    echo ""
    echo -e "${BLUE}📊 容器信息:${NC}"
    echo "   容器名称: $CONTAINER_NAME"
    echo "   访问地址: $BASE_URL"
    echo "   数据目录: $(pwd)/$DATA_DIR"
    echo "   日志查看: docker logs -f $CONTAINER_NAME"
    echo ""
    
    # 等待服务启动
    echo -e "${BLUE}⏳ 等待服务启动...${NC}"
    sleep 3
    
    # 检查健康状态
    if curl -f "$BASE_URL/api/health" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ 服务健康检查通过${NC}"
        echo -e "${GREEN}🎉 Magpie 已在 $BASE_URL 运行${NC}"
    else
        echo -e "${YELLOW}⚠️  服务可能还在启动中，请稍后检查${NC}"
        echo -e "   使用 './run-docker.sh logs' 查看日志"
    fi
}

# 停止容器
stop_container() {
    echo -e "${BLUE}⏹️  停止容器 $CONTAINER_NAME...${NC}"
    if docker stop "$CONTAINER_NAME" 2>/dev/null; then
        echo -e "${GREEN}✅ 容器已停止${NC}"
    else
        echo -e "${YELLOW}⚠️  容器不存在或已停止${NC}"
    fi
}

# 重启容器
restart_container() {
    stop_container
    sleep 2
    start_container
}

# 查看日志
show_logs() {
    echo -e "${BLUE}📋 查看容器日志...${NC}"
    docker logs -f "$CONTAINER_NAME"
}

# 查看状态
show_status() {
    echo -e "${BLUE}📊 容器状态:${NC}"
    if docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -q "$CONTAINER_NAME"; then
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep "$CONTAINER_NAME"
        echo ""
        echo -e "${GREEN}✅ 容器正在运行${NC}"
        
        # 健康检查
        if curl -f "$BASE_URL/api/health" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ API 健康检查通过${NC}"
        else
            echo -e "${RED}❌ API 健康检查失败${NC}"
        fi
    else
        echo -e "${RED}❌ 容器未运行${NC}"
    fi
}

# 清理容器
clean_container() {
    echo -e "${BLUE}🧹 清理容器...${NC}"
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
    echo -e "${GREEN}✅ 清理完成${NC}"
}

# 构建镜像
build_image() {
    echo -e "${BLUE}🔨 构建 Docker 镜像...${NC}"
    
    # Change to parent directory for build context
    cd "$(dirname "$0")/.." || exit 1
    
    local version=$(get_version_from_package)
    local git_info=$(get_git_info)
    
    echo -e "${BLUE}📋 版本信息:${NC}"
    echo "   Package 版本: $version"
    echo "   Git 信息: $git_info"
    echo "   构建标签: $IMAGE_TAG"
    echo ""
    
    # 构建镜像
    if [ "$IMAGE_TAG" = "latest" ] && [ "$version" != "latest" ]; then
        # 如果使用 latest 标签但有明确版本，同时构建版本标签
        echo -e "${BLUE}🏷️  构建多个标签: $version, latest${NC}"
        docker build -t "magpie:$version" -t "magpie:latest" .
        
        # 如果在开发分支，也添加开发标签
        if echo "$git_info" | grep -q "^master\|^main"; then
            # 在主分支，添加稳定标签
            echo -e "${BLUE}🎯 主分支检测，添加 stable 标签${NC}"
            docker tag "magpie:$version" "magpie:stable"
        elif ! echo "$git_info" | grep -q "^master\|^main"; then
            # 在开发分支，添加开发标签
            echo -e "${BLUE}🚧 开发分支检测，添加 dev-$git_info 标签${NC}"
            docker tag "magpie:$version" "magpie:dev-$git_info"
        fi
    else
        # 单标签构建
        docker build -t "magpie:$IMAGE_TAG" .
    fi
    
    cd - > /dev/null || exit 1
    echo -e "${GREEN}✅ 镜像构建完成${NC}"
    echo -e "${BLUE}📦 构建的镜像:${NC}"
    docker images magpie --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedAt}}\t{{.Size}}" | head -6
}

# 主函数
main() {
    # 获取命令
    COMMAND="${1:-start}"
    shift || true
    
    # 解析参数
    parse_args "$@"
    
    # 执行命令
    case "$COMMAND" in
        start)
            start_container
            ;;
        stop)
            stop_container
            ;;
        restart)
            restart_container
            ;;
        logs)
            show_logs
            ;;
        status)
            show_status
            ;;
        clean)
            clean_container
            ;;
        build)
            build_image
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}❌ 未知命令: $COMMAND${NC}"
            echo "使用 './run-docker.sh help' 查看帮助"
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"