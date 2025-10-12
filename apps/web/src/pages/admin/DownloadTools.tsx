import type { ReactNode } from 'react'
import { BoltIcon, LinkIcon } from '@heroicons/react/24/outline'

const SHORTCUT_DOWNLOAD_URL = 'https://www.icloud.com/shortcuts/1e0189f0c5cb4f59b0480abc10c5dc4a'
const CHROME_WEB_STORE_URL = 'https://chromewebstore.google.com/detail/magpie-%E6%89%A9%E5%B1%95/lpmbkjkipgafgaggkfiappkccccjjing'

function IconBadge({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-xl border border-magpie-200/40 bg-magpie-200/10 text-magpie-200">
      {children}
    </div>
  )
}

export default function DownloadTools() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">下载插件</h1>
          <p className="text-base-content/60 mt-1">
            使用官方插件快速把当前页面收藏到你的 Magpie 实例，支持 iOS、macOS 与 Chrome 浏览器。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 shadow-sm border border-base-200/60">
          <div className="card-body gap-4 p-6">
            <div className="flex items-center gap-4">
              <IconBadge>
                <BoltIcon className="size-6" />
              </IconBadge>
              <div>
                <h2 className="text-xl font-semibold text-base-content">快捷指令 · iOS / macOS</h2>
                <p className="text-sm text-base-content/60">
                  在 Safari 分享菜单或主屏小组件中，一步发送当前页面到 Magpie。
                </p>
              </div>
            </div>

            <div className="alert bg-magpie-200/10 border border-magpie-200/40 text-base-content/70 text-sm leading-relaxed">
              <div>
                首次运行时会提示输入你的 Magpie 域名与 API Token，信息会安全地保存在系统快捷指令中，可随时在快捷指令编辑界面调整。
              </div>
            </div>

            <a
              href={SHORTCUT_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary w-full"
            >
              下载「收藏到 Magpie」快捷指令
            </a>

            <div className="collapse collapse-arrow bg-base-200/60">
              <input type="checkbox" />
              <div className="collapse-title text-sm font-medium text-base-content/80">详情 · 安装与使用步骤</div>
              <div className="collapse-content text-sm text-base-content/70 leading-relaxed space-y-3">
                <ol className="list-decimal list-inside space-y-1">
                  <li>先在 Admin → API 令牌 页面创建一个专用的 Token，便于后续管理。</li>
                  <li>导入快捷指令到 macOS 或 iOS，首轮执行时填入你的 Magpie 实例 URL 和刚生成的 API Token。</li>
                  <li>复制想要收藏的链接到剪贴板，然后运行快捷指令即可完成分享，指令会调用 <code>/api/links</code> 接口上传数据。</li>
                </ol>
                <p>
                  小贴士：可将「收藏到 Magpie」固定到 Dock、菜单栏或为其设置双击背部等快捷入口，让发送链接更加顺手。
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm border border-base-200/60">
          <div className="card-body gap-4 p-6">
            <div className="flex items-center gap-4">
              <IconBadge>
                <LinkIcon className="size-6" />
              </IconBadge>
              <div>
                <h2 className="text-xl font-semibold text-base-content">Chrome 扩展</h2>
                <p className="text-sm text-base-content/60">
                  浏览任意网页时点一下按钮即可保存，可配置自动发布。
                </p>
              </div>
            </div>

            <div className="alert bg-magpie-200/10 border border-magpie-200/40 text-base-content/70 text-sm leading-relaxed">
              <div>
                安装后点击工具栏图标，按照向导设置服务器地址与 API Token；可在选项页配置默认分类、标签与自动发布策略。
              </div>
            </div>

            <a
              href={CHROME_WEB_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary w-full"
            >
              前往 Chrome Web Store 下载扩展
            </a>

            <div className="collapse collapse-arrow bg-base-200/60">
              <input type="checkbox" />
              <div className="collapse-title text-sm font-medium text-base-content/80">详情 · 设置建议</div>
              <div className="collapse-content text-sm text-base-content/70 leading-relaxed space-y-3">
                <ol className="list-decimal list-inside space-y-1">
                  <li>打开 Chrome Web Store 页面并点击「添加至 Chrome」，确认安装扩展。</li>
                  <li>首次启动弹窗时填写服务器地址与 API Token，可通过 Admin → API 令牌 页面生成。</li>
                  <li>在弹窗内可选择分类、标签或启用「自动发布」，也可打开选项页配置默认值。</li>
                </ol>
                <p>
                  推荐为扩展单独创建 Token，必要时可随时在 API 令牌页面撤销，以快速阻止失效或遗失的浏览器配置。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
