import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { links } from '../db/schema.js'
import { eq, desc, count, and } from 'drizzle-orm'
import { getSettings } from './settings.js'

/**
 * SEO静态HTML生成器
 * 为搜索引擎爬虫生成包含链接列表的HTML页面
 */

interface LinkData {
  id: number
  url: string
  title: string
  description: string
  category: string
  tags: string[]
  domain: string
  publishedAt: string
}

interface CategoryData {
  name: string
  count: number
}

interface SiteSettings {
  site_title: string
  site_description: string
  about_url?: string
}

/**
 * 获取爬虫页面所需的数据
 */
export async function getBotPageData(database: BetterSQLite3Database, category?: string) {
  try {
    // 构建查询条件
    let whereConditions = eq(links.status, 'published')
    if (category) {
      // 如果有分类过滤，添加分类条件
      whereConditions = and(whereConditions, eq(links.userCategory, category))
    }

    // 获取已发布链接 (50条，用于SEO)
    const linksResult = await database
      .select({
        id: links.id,
        url: links.url,
        title: links.title,
        description: links.userDescription,
        category: links.userCategory,
        tags: links.userTags,
        domain: links.domain,
        publishedAt: links.publishedAt,
      })
      .from(links)
      .where(whereConditions)
      .orderBy(desc(links.publishedAt))
      .limit(50)

    // 格式化链接数据
    const formattedLinks: LinkData[] = linksResult.map(link => ({
      id: link.id,
      url: link.url,
      title: link.title || '',
      description: link.description || '',
      category: link.category || '',
      tags: link.tags ? JSON.parse(link.tags) : [],
      domain: link.domain,
      publishedAt: new Date(link.publishedAt * 1000).toISOString(),
    }))

    // 获取分类统计
    const categoryStats = await database
      .select({
        name: links.userCategory,
        count: count(links.id),
      })
      .from(links)
      .where(eq(links.status, 'published'))
      .groupBy(links.userCategory)
      .orderBy(desc(count(links.id)))

    const categories: CategoryData[] = categoryStats
      .filter(cat => cat.name)
      .map(cat => ({
        name: cat.name,
        count: cat.count,
      }))

    // 获取站点设置
    const settings = await getSettings(database)
    const siteSettings: SiteSettings = {
      site_title: settings.site_title || 'Magpie - 链接收藏',
      site_description: settings.site_description || '收集和分享有趣的链接和内容',
      about_url: settings.about_url,
    }

    return {
      links: formattedLinks,
      categories,
      settings: siteSettings,
    }
  } catch (error) {
    console.error('Error fetching bot page data:', error)
    // 返回默认数据
    return {
      links: [],
      categories: [],
      settings: {
        site_title: 'Magpie - 链接收藏',
        site_description: '收集和分享有趣的链接和内容',
      },
    }
  }
}

/**
 * 生成JSON-LD结构化数据
 */
function generateStructuredData(data: { links: LinkData[]; settings: SiteSettings }) {
  const { links, settings } = data

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: settings.site_title,
    description: settings.site_description,
    url: '/',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: links.length,
      itemListElement: links.slice(0, 10).map((link, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'WebPage',
          name: link.title,
          description: link.description,
          url: link.url,
          datePublished: link.publishedAt,
          publisher: {
            '@type': 'Organization',
            name: settings.site_title,
          },
        },
      })),
    },
  }
}

/**
 * 生成分类导航HTML
 */
function generateCategoryNav(categories: CategoryData[]) {
  if (categories.length === 0) return ''

  const categoryItems = categories
    .slice(0, 10) // 限制显示数量
    .map(
      cat => `
    <a href="/?category=${encodeURIComponent(cat.name)}" class="category-link">
      ${escapeHtml(cat.name)} (${cat.count})
    </a>
  `
    )
    .join('')

  return `
    <nav class="categories" role="navigation" aria-label="分类导航">
      <h2>分类</h2>
      <div class="category-list">
        ${categoryItems}
      </div>
    </nav>
  `
}

/**
 * 生成链接列表HTML
 */
function generateLinkList(links: LinkData[]) {
  if (links.length === 0) {
    return '<p>暂无链接内容</p>'
  }

  const linkItems = links
    .map(
      link => `
    <article class="link-item" itemscope itemtype="https://schema.org/WebPage">
      <header>
        <h3 itemprop="name">
          <a href="${escapeHtml(link.url)}" itemprop="url" target="_blank" rel="noopener">
            ${escapeHtml(link.title)}
          </a>
        </h3>
        <div class="link-meta">
          <span class="domain">${escapeHtml(link.domain)}</span>
          <time datetime="${link.publishedAt}" itemprop="datePublished">
            ${new Date(link.publishedAt).toLocaleDateString('zh-CN')}
          </time>
          ${link.category ? `<span class="category">${escapeHtml(link.category)}</span>` : ''}
        </div>
      </header>
      ${
        link.description
          ? `<p class="description" itemprop="description">${escapeHtml(link.description)}</p>`
          : ''
      }
      ${
        link.tags.length > 0
          ? `
        <footer class="tags">
          ${link.tags
            .slice(0, 5)
            .map(tag => `<span class="tag">${escapeHtml(tag)}</span>`)
            .join('')}
        </footer>
      `
          : ''
      }
    </article>
  `
    )
    .join('')

  return `
    <section class="links-section">
      <h2>最新链接</h2>
      <div class="links-list">
        ${linkItems}
      </div>
    </section>
  `
}

/**
 * HTML转义
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

/**
 * 生成基础CSS样式
 */
function generateCSS() {
  return `
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
        background: #f5f5f5;
      }
      
      header {
        text-align: center;
        margin-bottom: 40px;
        padding: 30px 0;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      
      h1 {
        color: #2c3e50;
        margin-bottom: 10px;
        font-size: 2.5em;
      }
      
      .subtitle {
        color: #7f8c8d;
        font-size: 1.2em;
      }
      
      .categories {
        background: white;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 30px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      
      .category-list {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 15px;
      }
      
      .category-link {
        display: inline-block;
        padding: 8px 16px;
        background: #3498db;
        color: white;
        text-decoration: none;
        border-radius: 20px;
        font-size: 0.9em;
        transition: background-color 0.3s;
      }
      
      .category-link:hover {
        background: #2980b9;
      }
      
      .links-section {
        background: white;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      
      .link-item {
        padding: 25px 0;
        border-bottom: 1px solid #ecf0f1;
      }
      
      .link-item:last-child {
        border-bottom: none;
      }
      
      .link-item h3 {
        margin: 0 0 10px 0;
        font-size: 1.3em;
      }
      
      .link-item h3 a {
        color: #2c3e50;
        text-decoration: none;
      }
      
      .link-item h3 a:hover {
        color: #3498db;
      }
      
      .link-meta {
        display: flex;
        gap: 15px;
        font-size: 0.9em;
        color: #7f8c8d;
        margin-bottom: 10px;
        flex-wrap: wrap;
      }
      
      .domain {
        font-weight: 500;
      }
      
      .category {
        background: #e74c3c;
        color: white;
        padding: 2px 8px;
        border-radius: 3px;
        font-size: 0.8em;
      }
      
      .description {
        color: #34495e;
        margin: 15px 0;
        line-height: 1.7;
      }
      
      .tags {
        margin-top: 15px;
      }
      
      .tag {
        display: inline-block;
        background: #ecf0f1;
        color: #2c3e50;
        padding: 4px 8px;
        margin-right: 8px;
        margin-bottom: 5px;
        border-radius: 3px;
        font-size: 0.8em;
      }
      
      @media (max-width: 768px) {
        body {
          padding: 10px;
        }
        
        h1 {
          font-size: 2em;
        }
        
        .links-section, .categories {
          padding: 20px;
        }
        
        .link-meta {
          flex-direction: column;
          gap: 5px;
        }
      }
    </style>
  `
}

/**
 * 生成完整的SEO HTML页面
 */
export async function generateBotHTML(database: BetterSQLite3Database, searchParams?: URLSearchParams): Promise<string> {
  // 解析分类参数
  const category = searchParams?.get('category') || undefined
  
  const data = await getBotPageData(database, category)
  const structuredData = generateStructuredData(data)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.settings.site_title)}</title>
  <meta name="description" content="${escapeHtml(data.settings.site_description)}">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(data.settings.site_title)}">
  <meta property="og:description" content="${escapeHtml(data.settings.site_description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="/">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(data.settings.site_title)}">
  <meta name="twitter:description" content="${escapeHtml(data.settings.site_description)}">
  
  <!-- 结构化数据 -->
  <script type="application/ld+json">
    ${JSON.stringify(structuredData, null, 2)}
  </script>
  
  ${generateCSS()}
</head>
<body>
  <header>
    <h1>${escapeHtml(data.settings.site_title)}</h1>
    <p class="subtitle">${escapeHtml(data.settings.site_description)}</p>
    ${data.settings.about_url ? `<a href="${escapeHtml(data.settings.about_url)}" target="_blank" rel="noopener">关于我们</a>` : ''}
  </header>
  
  <main>
    ${generateCategoryNav(data.categories)}
    ${generateLinkList(data.links)}
  </main>
  
  <footer style="text-align: center; margin-top: 50px; padding: 20px; color: #7f8c8d;">
    <p>© ${new Date().getFullYear()} ${escapeHtml(data.settings.site_title)} - 由 Magpie 强力驱动</p>
  </footer>
</body>
</html>`
}