import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 日志目录配置 - 根据环境智能选择
function getLogDir() {
  // 如果指定了 LOG_DIR 环境变量，使用它
  if (process.env.LOG_DIR) {
    return process.env.LOG_DIR;
  }

  // Docker 环境，使用 /app/data/logs
  if (fs.existsSync('/app')) {
    return '/app/data/logs';
  }

  // 开发环境和生产环境，使用项目根目录下的 data/logs
  // 这样和数据库文件 data/magpie.db 在同一层级
  return path.join(__dirname, '..', '..', '..', '..', 'data', 'logs');
}

const LOG_DIR = getLogDir();
const IS_TEST_ENV = process.env.NODE_ENV === 'test';
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_TEST_ENV ? 'silent' : (process.env.NODE_ENV === 'production' ? 'info' : 'debug'));
const DEFAULT_APPLICATION_META = { application: 'magpie' } as const;

// 确保日志目录存在
if (!IS_TEST_ENV) {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (error) {
    process.emitWarning(`Could not create log directory ${LOG_DIR}. Logging to console only.`);
  }
}

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp = '', level = '', message = '' } = info;
    const applicationName = typeof info.application === 'string' ? info.application : undefined;
    const serviceName = typeof info.service === 'string' ? info.service : undefined;

    const meta: Record<string, unknown> = { ...info };
    delete meta.timestamp;
    delete meta.level;
    delete meta.message;
    delete meta.application;
    delete meta.service;

    const parts: string[] = [String(timestamp), String(level).toUpperCase()];
    if (applicationName) {
      parts.push(`[${applicationName}]`);
    }
    if (serviceName) {
      parts.push(`[${serviceName}]`);
    }
    parts.push(String(message));

    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${parts.join(' ')}${metaStr}`;
  })
);

// JSON格式（用于文件日志，便于后续分析）
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// 创建传输器数组
const transports: winston.transport[] = [];

if (!IS_TEST_ENV) {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  );
}

// 只有在日志目录可用时才添加文件传输器
if (!IS_TEST_ENV && fs.existsSync(LOG_DIR)) {
  try {
    // 错误日志文件
    transports.push(new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }));

    // 完整日志文件
    transports.push(new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: jsonFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }));
  } catch (error) {
    process.emitWarning('Could not create file transports. Using console logging only.');
  }
}

// 创建基础logger
const baseLogger = winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: { ...DEFAULT_APPLICATION_META },
  transports,
  silent: IS_TEST_ENV
});

// 创建专门的分类logger
export const createLogger = (service: string) => {
  return baseLogger.child({ service });
};

// 预定义的分类logger
export const systemLogger = createLogger('system');
export const apiLogger = createLogger('api');
export const taskLogger = createLogger('task');
export const adminLogger = createLogger('admin');
export const scraperLogger = createLogger('scraper');
export const aiLogger = createLogger('ai');

// 导出默认logger
export const logger = baseLogger;

// 日志级别枚举
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

// 便捷的日志方法
export const logError = (message: string, meta?: any, service?: string) => {
  const targetLogger = service ? createLogger(service) : logger;
  targetLogger.error(message, meta);
};

export const logWarn = (message: string, meta?: any, service?: string) => {
  const targetLogger = service ? createLogger(service) : logger;
  targetLogger.warn(message, meta);
};

export const logInfo = (message: string, meta?: any, service?: string) => {
  const targetLogger = service ? createLogger(service) : logger;
  targetLogger.info(message, meta);
};

export const logDebug = (message: string, meta?: any, service?: string) => {
  const targetLogger = service ? createLogger(service) : logger;
  targetLogger.debug(message, meta);
};

// API请求日志记录器
export const logApiRequest = (method: string, url: string, statusCode?: number, duration?: number, meta?: any) => {
  apiLogger.info('API Request', {
    method,
    url,
    statusCode,
    duration,
    ...meta
  });
};

// 任务执行日志记录器
export const logTaskExecution = (taskName: string, status: 'start' | 'success' | 'error', duration?: number, meta?: any) => {
  const level = status === 'error' ? 'error' : 'info';
  taskLogger[level](`Task ${taskName} ${status}`, {
    taskName,
    status,
    duration,
    ...meta
  });
};

// Admin操作日志记录器
export const logAdminAction = (action: string, userId?: string, details?: any) => {
  adminLogger.info(`Admin action: ${action}`, {
    action,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// AI分析日志记录器
export const logAiAnalysis = (url: string, status: 'start' | 'success' | 'error', prompt?: string, response?: any, error?: any) => {
  const level = status === 'error' ? 'error' : 'info';
  aiLogger[level](`AI analysis ${status} for ${url}`, {
    url,
    status,
    prompt: prompt ? (prompt.length > 500 ? prompt.substring(0, 500) + '...' : prompt) : undefined,
    response: response ? JSON.stringify(response).substring(0, 1000) : undefined,
    error: error ? error.message || error : undefined
  });
};

// 网页抓取日志记录器
export const logScraping = (url: string, status: 'start' | 'success' | 'error', duration?: number, contentLength?: number, error?: any) => {
  const level = status === 'error' ? 'error' : 'info';
  scraperLogger[level](`Scraping ${status} for ${url}`, {
    url,
    status,
    duration,
    contentLength,
    error: error ? error.message || error : undefined
  });
};

// 系统启动时记录配置信息
export const logSystemStart = () => {
  systemLogger.info('Magpie system starting', {
    nodeEnv: process.env.NODE_ENV,
    logLevel: LOG_LEVEL,
    logDir: LOG_DIR,
    version: process.env.npm_package_version
  });
};

export default logger;
