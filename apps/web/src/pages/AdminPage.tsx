export default function AdminPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">管理后台</h1>
        <p className="text-base-content/70">管理功能正在开发中...</p>
        
        <div className="mt-8">
          <div className="alert alert-warning">
            <div>
              <svg className="stroke-current shrink-0 w-6 h-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 className="font-bold">开发中</h3>
                <div className="text-xs">管理后台功能将在下一个阶段实现</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}