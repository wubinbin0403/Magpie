#!/usr/bin/env tsx

import { db } from './index.js';
import { settings, apiTokens, links, categories } from './schema.js';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

const DEFAULT_SETTINGS = [
  // Site basic information
  { key: 'site_title', value: 'Magpie', type: 'string', description: '站点标题' },
  { key: 'site_description', value: '收集和分享有趣的链接', type: 'string', description: '站点描述' },
  { key: 'about_url', value: '', type: 'string', description: '关于页面URL' },
  
  // AI service configuration
  { key: 'openai_api_key', value: '', type: 'string', description: 'OpenAI API密钥' },
  { key: 'openai_base_url', value: 'https://api.openai.com/v1', type: 'string', description: 'OpenAI API基础URL' },
  { key: 'ai_model', value: 'gpt-3.5-turbo', type: 'string', description: 'AI模型名称' },
  { key: 'ai_temperature', value: '0.7', type: 'number', description: 'AI温度参数' },
  
  // Prompt templates
  { 
    key: 'ai_summary_prompt', 
    value: '请分析以下网页内容，生成50字以内的中文摘要：\n\n标题：{title}\nURL：{url}\n内容：{content}\n\n要求：\n1. 简洁明了，突出核心观点\n2. 50字以内\n3. 使用中文', 
    type: 'string', 
    description: 'AI摘要生成提示词' 
  },
  { 
    key: 'ai_category_prompt', 
    value: '基于内容，从以下分类中选择最合适的1个：{categories}\n\n如果都不合适，可以建议新分类。', 
    type: 'string', 
    description: 'AI分类提示词' 
  },
  
  // Content settings
  { key: 'default_category', value: '其他', type: 'string', description: '默认分类' },
  { key: 'categories', value: '["技术", "设计", "产品", "工具", "其他"]', type: 'json', description: '可用分类列表' },
  { key: 'items_per_page', value: '20', type: 'number', description: '每页显示数量' },
  
  // System configuration
  { key: 'max_content_length', value: '10000', type: 'number', description: '最大内容长度' },
  { key: 'rate_limit_per_minute', value: '50', type: 'number', description: '每分钟请求限制' },
  
  // Database version
  { key: 'db_version', value: '1.0.0', type: 'string', description: '数据库版本' },
] as const;

// Default categories for the system
const DEFAULT_CATEGORIES = [
  {
    name: '技术',
    slug: 'tech',
    icon: 'code',
    color: '#3B82F6',
    description: '编程、开发、技术相关内容',
    displayOrder: 1
  },
  {
    name: '设计',
    slug: 'design',
    icon: 'palette',
    color: '#8B5CF6',
    description: '设计、UI/UX、创意相关内容',
    displayOrder: 2
  },
  {
    name: '产品',
    slug: 'product',
    icon: 'cube',
    color: '#10B981',
    description: '产品管理、商业分析相关内容',
    displayOrder: 3
  },
  {
    name: '工具',
    slug: 'tools',
    icon: 'wrench',
    color: '#F59E0B',
    description: '实用工具、软件推荐',
    displayOrder: 4
  },
  {
    name: '游戏',
    slug: 'game',
    icon: 'game-controller',
    color: '#EC4899',
    description: '游戏相关内容',
    displayOrder: 5
  },
  {
    name: '其他',
    slug: 'other',
    icon: 'folder',
    color: '#6B7280',
    description: '其他未分类内容',
    displayOrder: 99
  }
] as const;

// Sample links for development environment
const SAMPLE_LINKS = [
  // Pending links for testing admin confirmation flow
  {
    url: 'https://astro.build/blog/astro-4.5/',
    domain: 'astro.build', 
    title: 'Astro 4.5: Dev Audit UI & Performance Improvements',
    originalDescription: 'Astro 4.5 introduces a new dev audit UI, performance improvements, and better developer experience.',
    aiSummary: 'Astro 4.5发布，新增开发审计UI、性能改进和更好的开发体验，提升静态站点生成器的易用性。',
    aiCategory: '技术',
    aiTags: '["Astro", "静态站点", "开发工具"]',
    finalCategory: '',
    finalTags: '',
    status: 'pending'
  },
  {
    url: 'https://www.mongodb.com/blog/post/mongodb-7.0-available',
    domain: 'mongodb.com',
    title: 'MongoDB 7.0: Vector Search & Time Series Collections',
    originalDescription: 'MongoDB 7.0 introduces native vector search capabilities and enhanced time series collections for modern applications.',
    aiSummary: 'MongoDB 7.0推出原生向量搜索和增强时间序列集合，为现代AI应用提供强大的数据库支持。',
    aiCategory: '技术', 
    aiTags: '["MongoDB", "数据库", "向量搜索", "AI"]',
    finalCategory: '',
    finalTags: '',
    status: 'pending'
  },
  {
    url: 'https://lottiefiles.com/blog/introducing-lottie-interactivity',
    domain: 'lottiefiles.com',
    title: 'Interactive Lottie Animations for Web',
    originalDescription: 'Create interactive Lottie animations with click, hover, and scroll triggers for engaging web experiences.',
    aiSummary: 'LottieFiles推出交互式Lottie动画功能，支持点击、悬停和滚动触发，打造更吸引人的网页体验。',
    aiCategory: '设计',
    aiTags: '["Lottie", "动画", "交互设计", "Web"]',
    finalCategory: '',
    finalTags: '',
    status: 'pending'
  },
  // Published links
  {
    url: 'https://react.dev/blog/2024/04/25/react-19',
    domain: 'react.dev',
    title: 'React 19 RC',
    originalDescription: 'React 19 RC is now available on npm! In this post, we give an overview of the new features in React 19, and how you can adopt them.',
    aiSummary: 'React 19候选版本发布，介绍新功能包括Actions、useTransition等改进，提升开发体验和性能。',
    aiCategory: '技术',
    aiTags: '["React", "前端", "JavaScript"]',
    finalCategory: '技术',
    finalTags: '["React", "前端", "JavaScript"]',
    status: 'published'
  },
  {
    url: 'https://github.com/microsoft/TypeScript/releases/tag/v5.4.0',
    domain: 'github.com',
    title: 'TypeScript 5.4',
    originalDescription: 'TypeScript 5.4 brings new features like the NoInfer utility type, Object.groupBy and Map.groupBy support, and more.',
    aiSummary: 'TypeScript 5.4版本发布，新增NoInfer工具类型，支持Object.groupBy等特性，提升类型推导能力。',
    aiCategory: '技术',
    aiTags: '["TypeScript", "编程语言", "开发工具"]',
    finalCategory: '技术',
    finalTags: '["TypeScript", "编程语言", "开发工具"]',
    status: 'published'
  },
  {
    url: 'https://tailwindcss.com/blog/tailwindcss-v4-alpha',
    domain: 'tailwindcss.com',
    title: 'Tailwind CSS v4.0 Alpha',
    originalDescription: 'Tailwind CSS v4.0 alpha is here with a new engine, oxide parser, and lightning-fast performance.',
    aiSummary: 'Tailwind CSS v4.0 Alpha版本发布，采用新引擎和oxide解析器，显著提升性能和构建速度。',
    aiCategory: '技术',
    aiTags: '["CSS", "前端", "设计系统"]',
    finalCategory: '技术',
    finalTags: '["CSS", "前端", "设计系统"]',
    status: 'published'
  },
  {
    url: 'https://figma.com/blog/introducing-figma-slides/',
    domain: 'figma.com',
    title: 'Introducing Figma Slides',
    originalDescription: 'Build beautiful presentations with the design tools you already love. Figma Slides is now available to everyone.',
    aiSummary: 'Figma推出Slides演示文稿功能，让用户使用熟悉的设计工具创建精美的演示文稿。',
    aiCategory: '设计',
    aiTags: '["Figma", "设计工具", "演示"]',
    finalCategory: '设计',
    finalTags: '["Figma", "设计工具", "演示"]',
    status: 'published'
  },
  {
    url: 'https://linear.app/changelog/2024-03-28',
    domain: 'linear.app',
    title: 'Linear March Updates',
    originalDescription: 'New team templates, improved project planning, and better GitHub integration.',
    aiSummary: 'Linear三月更新，新增团队模板、改进项目规划功能和GitHub集成体验。',
    aiCategory: '产品',
    aiTags: '["Linear", "项目管理", "团队协作"]',
    finalCategory: '产品',
    finalTags: '["Linear", "项目管理", "团队协作"]',
    status: 'published'
  },
  {
    url: 'https://openai.com/blog/gpt-4-turbo',
    domain: 'openai.com',
    title: 'GPT-4 Turbo with Vision',
    originalDescription: 'GPT-4 Turbo with vision, updated knowledge, and new modalities. More capable, efficient, and cost-effective.',
    aiSummary: 'OpenAI发布GPT-4 Turbo视觉版本，具备更强能力、更高效率和更低成本。',
    aiCategory: '技术',
    aiTags: '["AI", "OpenAI", "机器学习"]',
    finalCategory: '技术',
    finalTags: '["AI", "OpenAI", "机器学习"]',
    status: 'published'
  },
  {
    url: 'https://vercel.com/blog/vercel-v0-generative-ui',
    domain: 'vercel.com',
    title: 'v0: Generative UI',
    originalDescription: 'Generate UI components from text prompts with v0, powered by AI and React.',
    aiSummary: 'Vercel推出v0生成式UI工具，通过AI和React从文本提示生成UI组件。',
    aiCategory: '工具',
    aiTags: '["Vercel", "AI", "UI生成"]',
    finalCategory: '工具',
    finalTags: '["Vercel", "AI", "UI生成"]',
    status: 'published'
  },
  {
    url: 'https://daisyui.com/blog/daisyui-4.0/',
    domain: 'daisyui.com',
    title: 'daisyUI 4.0 is here',
    originalDescription: 'daisyUI 4.0 comes with new themes, improved accessibility, and better customization.',
    aiSummary: 'daisyUI 4.0发布，新增主题、改进无障碍支持和自定义能力。',
    aiCategory: '技术',
    aiTags: '["daisyUI", "CSS框架", "Tailwind"]',
    finalCategory: '技术',
    finalTags: '["daisyUI", "CSS框架", "Tailwind"]',
    status: 'published'
  },
  {
    url: 'https://arc.net/blog/arc-search-browse-for-me',
    domain: 'arc.net',
    title: 'Arc Search: Browse for Me',
    originalDescription: 'AI-powered browsing that reads multiple pages and creates a custom page just for you.',
    aiSummary: 'Arc浏览器推出AI驱动的"为我浏览"功能，自动阅读多个页面并创建定制化内容。',
    aiCategory: '产品',
    aiTags: '["Arc浏览器", "AI", "浏览器"]',
    finalCategory: '产品',
    finalTags: '["Arc浏览器", "AI", "浏览器"]',
    status: 'published'
  },
  {
    url: 'https://supabase.com/blog/realtime-multiplayer-games',
    domain: 'supabase.com',
    title: 'Building Realtime Multiplayer Games with Supabase',
    originalDescription: 'Learn how to build realtime multiplayer games using Supabase Realtime and Presence.',
    aiSummary: '使用Supabase Realtime和Presence功能构建实时多人游戏的完整指南。',
    aiCategory: '技术',
    aiTags: '["Supabase", "实时通信", "游戏开发"]',
    finalCategory: '技术',
    finalTags: '["Supabase", "实时通信", "游戏开发"]',
    status: 'published'
  },
  {
    url: 'https://raycast.com/blog/raycast-ai-commands',
    domain: 'raycast.com',
    title: 'Raycast AI Commands',
    originalDescription: 'Supercharge your productivity with AI-powered commands built into Raycast.',
    aiSummary: 'Raycast集成AI命令功能，通过智能自动化提升工作效率和生产力。',
    aiCategory: '工具',
    aiTags: '["Raycast", "AI", "效率工具"]',
    finalCategory: '工具',
    finalTags: '["Raycast", "AI", "效率工具"]',
    status: 'published'
  },
  {
    url: 'https://design.systems/articles/design-tokens-scaling-design-decisions/',
    domain: 'design.systems',
    title: 'Design Tokens for Scaling Design Decisions',
    originalDescription: 'How design tokens help teams scale design decisions across products and platforms.',
    aiSummary: '设计令牌如何帮助团队在产品和平台之间扩展设计决策的最佳实践指南。',
    aiCategory: '设计',
    aiTags: '["设计令牌", "设计系统", "团队协作"]',
    finalCategory: '设计',
    finalTags: '["设计令牌", "设计系统", "团队协作"]',
    status: 'published'
  },
  {
    url: 'https://www.anthropic.com/news/claude-3-family',
    domain: 'anthropic.com',
    title: 'Introducing the Claude 3 Model Family',
    originalDescription: 'Claude 3 Haiku, Claude 3 Sonnet, and Claude 3 Opus deliver state-of-the-art performance across cognitive tasks.',
    aiSummary: 'Anthropic发布Claude 3系列模型，包括Haiku、Sonnet和Opus，在认知任务上达到最先进性能。',
    aiCategory: '技术',
    aiTags: '["Claude", "AI模型", "Anthropic"]',
    finalCategory: '技术',
    finalTags: '["Claude", "AI模型", "Anthropic"]',
    status: 'published'
  },
  {
    url: 'https://notion.so/blog/notion-ai-q-and-a',
    domain: 'notion.so',
    title: 'Notion AI Q&A',
    originalDescription: 'Get instant answers from your Notion workspace with AI-powered Q&A.',
    aiSummary: 'Notion推出AI问答功能，从工作空间内容中获取即时智能回答。',
    aiCategory: '产品',
    aiTags: '["Notion", "AI", "知识管理"]',
    finalCategory: '产品',
    finalTags: '["Notion", "AI", "知识管理"]',
    status: 'published'
  },
  {
    url: 'https://vitejs.dev/blog/announcing-vite5.html',
    domain: 'vitejs.dev',
    title: 'Vite 5.0 is out!',
    originalDescription: 'Vite 5.0 is now available with Rollup 4 support, new dev server improvements, and more.',
    aiSummary: 'Vite 5.0正式发布，支持Rollup 4，改进开发服务器性能和开发体验。',
    aiCategory: '技术',
    aiTags: '["Vite", "构建工具", "前端"]',
    finalCategory: '技术',
    finalTags: '["Vite", "构建工具", "前端"]',
    status: 'published'
  },
  {
    url: 'https://hono.dev/blog/2024-03-hono-v4',
    domain: 'hono.dev',
    title: 'Hono v4',
    originalDescription: 'Hono v4 brings better TypeScript support, middleware improvements, and performance enhancements.',
    aiSummary: 'Hono v4发布，增强TypeScript支持、改进中间件架构和性能优化。',
    aiCategory: '技术',
    aiTags: '["Hono", "Web框架", "TypeScript"]',
    finalCategory: '技术',
    finalTags: '["Hono", "Web框架", "TypeScript"]',
    status: 'published'
  },
  {
    url: 'https://stripe.com/blog/elements-improvements-2024',
    domain: 'stripe.com',
    title: 'Stripe Elements Improvements',
    originalDescription: 'New Stripe Elements features including improved mobile experience and better customization options.',
    aiSummary: 'Stripe Elements改进，提升移动端体验和自定义选项，优化支付流程。',
    aiCategory: '产品',
    aiTags: '["Stripe", "支付", "Web组件"]',
    finalCategory: '产品',
    finalTags: '["Stripe", "支付", "Web组件"]',
    status: 'published'
  },
  {
    url: 'https://discord.com/blog/how-discord-stores-trillions-of-messages',
    domain: 'discord.com',
    title: 'How Discord Stores Trillions of Messages',
    originalDescription: 'A deep dive into Discord\'s message storage architecture and how we scale to trillions of messages.',
    aiSummary: 'Discord技术分享，详解如何构建万亿级消息存储架构和扩展策略。',
    aiCategory: '技术',
    aiTags: '["Discord", "架构设计", "数据库"]',
    finalCategory: '技术',
    finalTags: '["Discord", "架构设计", "数据库"]',
    status: 'published'
  },
  {
    url: 'https://github.blog/2024-04-03-github-copilot-workspace/',
    domain: 'github.com',
    title: 'GitHub Copilot Workspace',
    originalDescription: 'A new AI-native development environment that helps you brainstorm, plan, build, test, and run code.',
    aiSummary: 'GitHub推出Copilot Workspace，AI原生开发环境支持从构思到部署的完整开发流程。',
    aiCategory: '工具',
    aiTags: '["GitHub", "AI编程", "开发环境"]',
    finalCategory: '工具',
    finalTags: '["GitHub", "AI编程", "开发环境"]',
    status: 'published'
  },
  {
    url: 'https://planetscale.com/blog/planetscale-serverless-driver',
    domain: 'planetscale.com',
    title: 'PlanetScale Serverless Driver',
    originalDescription: 'Connect to PlanetScale from serverless environments with our new JavaScript driver.',
    aiSummary: 'PlanetScale推出无服务器JavaScript驱动，支持从无服务器环境连接数据库。',
    aiCategory: '技术',
    aiTags: '["PlanetScale", "数据库", "Serverless"]',
    finalCategory: '技术',
    finalTags: '["PlanetScale", "数据库", "Serverless"]',
    status: 'published'
  },
  {
    url: 'https://www.cursor.sh/blog/introducing-cursor-composer',
    domain: 'cursor.sh',
    title: 'Introducing Cursor Composer',
    originalDescription: 'AI-powered code generation that understands your entire codebase and writes code across multiple files.',
    aiSummary: 'Cursor推出Composer功能，AI理解整个代码库并支持跨文件代码生成。',
    aiCategory: '工具',
    aiTags: '["Cursor", "AI编程", "代码生成"]',
    finalCategory: '工具',
    finalTags: '["Cursor", "AI编程", "代码生成"]',
    status: 'published'
  },
  {
    url: 'https://blog.excalidraw.com/excalidraw-2024/',
    domain: 'excalidraw.com',
    title: 'Excalidraw 2024 Roadmap',
    originalDescription: 'What\'s coming to Excalidraw in 2024: better collaboration, mobile app, and new features.',
    aiSummary: 'Excalidraw 2024路线图，计划改进协作功能、推出移动应用和新特性。',
    aiCategory: '设计',
    aiTags: '["Excalidraw", "绘图工具", "协作"]',
    finalCategory: '设计',
    finalTags: '["Excalidraw", "绘图工具", "协作"]',
    status: 'published'
  },
  {
    url: 'https://nextjs.org/blog/next-14-2',
    domain: 'nextjs.org',
    title: 'Next.js 14.2',
    originalDescription: 'Next.js 14.2 includes Turbopack for dev (Release Candidate), build and production improvements.',
    aiSummary: 'Next.js 14.2发布，Turbopack开发模式进入RC阶段，改进构建和生产性能。',
    aiCategory: '技术',
    aiTags: '["Next.js", "React", "构建工具"]',
    finalCategory: '技术',
    finalTags: '["Next.js", "React", "构建工具"]',
    status: 'published'
  },
  {
    url: 'https://www.framer.com/blog/posts/framer-sites-performance/',
    domain: 'framer.com',
    title: 'Framer Sites Performance',
    originalDescription: 'How we made Framer sites 3x faster with better caching, code splitting, and optimization.',
    aiSummary: 'Framer通过缓存优化、代码分割等技术将网站性能提升3倍。',
    aiCategory: '技术',
    aiTags: '["Framer", "性能优化", "Web开发"]',
    finalCategory: '技术',
    finalTags: '["Framer", "性能优化", "Web开发"]',
    status: 'published'
  },
  {
    url: 'https://bun.sh/blog/bun-v1.1',
    domain: 'bun.sh',
    title: 'Bun v1.1',
    originalDescription: 'Bun v1.1 includes Windows support, improved Node.js compatibility, and better performance.',
    aiSummary: 'Bun v1.1发布，新增Windows支持，改进Node.js兼容性和性能表现。',
    aiCategory: '技术',
    aiTags: '["Bun", "JavaScript运行时", "性能"]',
    finalCategory: '技术',
    finalTags: '["Bun", "JavaScript运行时", "性能"]',
    status: 'published'
  },
  {
    url: 'https://obsidian.md/blog/new-obsidian-mobile-editor/',
    domain: 'obsidian.md',
    title: 'New Obsidian Mobile Editor',
    originalDescription: 'Redesigned mobile editing experience with improved touch controls and better performance.',
    aiSummary: 'Obsidian重新设计移动端编辑器，改进触控体验和性能表现。',
    aiCategory: '产品',
    aiTags: '["Obsidian", "笔记工具", "移动端"]',
    finalCategory: '产品',
    finalTags: '["Obsidian", "笔记工具", "移动端"]',
    status: 'published'
  },
  {
    url: 'https://firebase.google.com/blog/2024-03-web-frameworks',
    domain: 'firebase.google.com',
    title: 'Firebase Web Frameworks',
    originalDescription: 'Better integration with modern web frameworks including Next.js, Nuxt, and SvelteKit.',
    aiSummary: 'Firebase改进现代Web框架集成，更好支持Next.js、Nuxt和SvelteKit。',
    aiCategory: '技术',
    aiTags: '["Firebase", "Web框架", "云服务"]',
    finalCategory: '技术',
    finalTags: '["Firebase", "Web框架", "云服务"]',
    status: 'published'
  },
  {
    url: 'https://ui.shadcn.com/docs/changelog',
    domain: 'ui.shadcn.com',
    title: 'shadcn/ui Updates',
    originalDescription: 'New components, improved accessibility, and better TypeScript support in the latest shadcn/ui updates.',
    aiSummary: 'shadcn/ui更新，新增组件、改进无障碍支持和TypeScript集成。',
    aiCategory: '技术',
    aiTags: '["shadcn/ui", "React组件", "UI库"]',
    finalCategory: '技术',
    finalTags: '["shadcn/ui", "React组件", "UI库"]',
    status: 'published'
  },
  {
    url: 'https://www.producthunt.com/blog/how-we-built-our-new-homepage',
    domain: 'producthunt.com',
    title: 'How We Built Our New Homepage',
    originalDescription: 'Behind the scenes of Product Hunt\'s homepage redesign with improved performance and user experience.',
    aiSummary: 'Product Hunt分享主页重设计过程，专注于性能优化和用户体验改进。',
    aiCategory: '产品',
    aiTags: '["Product Hunt", "网站设计", "用户体验"]',
    finalCategory: '产品',
    finalTags: '["Product Hunt", "网站设计", "用户体验"]',
    status: 'published'
  },
  {
    url: 'https://clerk.com/blog/local-development-https',
    domain: 'clerk.com',
    title: 'HTTPS in Local Development',
    originalDescription: 'How to set up HTTPS for local development and why it matters for modern web applications.',
    aiSummary: '在本地开发环境配置HTTPS的完整指南，解释为什么对现代Web应用至关重要。',
    aiCategory: '技术',
    aiTags: '["HTTPS", "本地开发", "Web安全"]',
    finalCategory: '技术',
    finalTags: '["HTTPS", "本地开发", "Web安全"]',
    status: 'published'
  },
  {
    url: 'https://mux.com/blog/what-is-low-latency-live-streaming/',
    domain: 'mux.com',
    title: 'What is Low Latency Live Streaming?',
    originalDescription: 'Understanding the technology behind low-latency live streaming and when to use it.',
    aiSummary: '深入解析低延迟直播流技术原理，以及在何种场景下应该使用。',
    aiCategory: '技术',
    aiTags: '["直播技术", "低延迟", "音视频"]',
    finalCategory: '技术',
    finalTags: '["直播技术", "低延迟", "音视频"]',
    status: 'published'
  }
] as const;

async function seedDatabase(database = db, includeDevData = false) {
  console.log('Starting database seeding...');
  
  const now = Math.floor(Date.now() / 1000);
  
  try {
    // Insert default settings
    console.log('Inserting default settings...');
    
    for (const setting of DEFAULT_SETTINGS) {
      // Check if setting already exists
      const existing = await database.select().from(settings).where(eq(settings.key, setting.key)).limit(1);
      
      if (existing.length === 0) {
        await database.insert(settings).values({
          key: setting.key,
          value: setting.value,
          type: setting.type as 'string' | 'number' | 'boolean' | 'json',
          description: setting.description,
          createdAt: now,
          updatedAt: now,
        });
        console.log(`✓ Added setting: ${setting.key}`);
      } else {
        console.log(`- Setting already exists: ${setting.key}`);
      }
    }

    // Insert default categories
    console.log('Inserting default categories...');
    
    for (const category of DEFAULT_CATEGORIES) {
      // Check if category already exists
      const existing = await database.select().from(categories).where(eq(categories.name, category.name)).limit(1);
      
      if (existing.length === 0) {
        await database.insert(categories).values({
          name: category.name,
          slug: category.slug,
          icon: category.icon,
          color: category.color,
          description: category.description,
          displayOrder: category.displayOrder,
          isActive: 1,
          createdAt: now,
          updatedAt: now,
        });
        console.log(`✓ Added category: ${category.name}`);
      } else {
        console.log(`- Category already exists: ${category.name}`);
      }
    }
    
    // Create initial admin API token if none exists
    console.log('Checking for admin API tokens...');
    
    const existingTokens = await database.select().from(apiTokens).limit(1);
    let tokenResult;
    
    if (existingTokens.length === 0) {
      const tokenValue = 'mgp_' + crypto.randomBytes(32).toString('hex');
      
      await database.insert(apiTokens).values({
        token: tokenValue,
        name: 'Initial Admin Token',
        prefix: 'mgp_',
        status: 'active',
        createdAt: now,
      });
      
      console.log(`✓ Created initial admin token: ${tokenValue}`);
      console.log('  ⚠️  Please save this token - it will not be shown again!');
      tokenResult = { tokenValue };
    } else {
      console.log('- Admin tokens already exist');
      tokenResult = { tokenValue: null };
    }

    // Insert sample links if requested (for development)
    if (includeDevData) {
      console.log('Inserting sample links for development...');
      
      for (let i = 0; i < SAMPLE_LINKS.length; i++) {
        const link = SAMPLE_LINKS[i];
        
        // Create varied timestamps spread over the last 3 months
        const daysAgo = Math.floor(Math.random() * 90); // 0-90 days ago
        const hoursAgo = Math.floor(Math.random() * 24); // 0-24 hours within that day
        const linkCreatedAt = now - (daysAgo * 24 * 60 * 60) - (hoursAgo * 60 * 60);
        const linkPublishedAt = linkCreatedAt + Math.floor(Math.random() * 3600); // Published within 1 hour of creation
        
        // Set final description to aiSummary for now (simulating user confirmation)
        const finalDescription = link.aiSummary;
        
        // Create search text for optimization
        const searchText = `${link.title} ${link.aiSummary} ${link.finalCategory} ${link.finalTags}`.toLowerCase();
        
        await database.insert(links).values({
          url: link.url,
          domain: link.domain,
          title: link.title,
          originalDescription: link.originalDescription,
          aiSummary: link.aiSummary,
          aiCategory: link.aiCategory,
          aiTags: link.aiTags,
          finalDescription,
          finalCategory: link.finalCategory,
          finalTags: link.finalTags,
          status: link.status as 'pending' | 'published' | 'deleted',
          createdAt: linkCreatedAt,
          publishedAt: link.status === 'published' ? linkPublishedAt : undefined,
          searchText,
        });
        
        if ((i + 1) % 10 === 0) {
          console.log(`✓ Inserted ${i + 1}/${SAMPLE_LINKS.length} sample links`);
        }
      }
      
      console.log(`✓ Inserted all ${SAMPLE_LINKS.length} sample links`);
      
      // Populate FTS5 index for existing published links
      console.log('Populating FTS5 search index...');
      await database.run(sql`
        INSERT INTO links_fts(rowid, title, final_description, final_tags, domain, final_category)
        SELECT id, title, final_description, final_tags, domain, final_category 
        FROM links 
        WHERE status = 'published'
      `);
      console.log('✓ FTS5 search index populated');
    }
    
    console.log('Database seeding completed successfully!');
    
    return tokenResult;
    
  } catch (error) {
    console.error('Database seeding failed:', error);
    throw error;
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Check if --dev flag is passed
  const includeDevData = process.argv.includes('--dev');
  
  if (includeDevData) {
    console.log('🚀 Running database seeding with development data...\n');
  } else {
    console.log('🚀 Running basic database seeding...\n');
  }
  
  seedDatabase(db, includeDevData)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seedDatabase };