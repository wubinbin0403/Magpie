interface LoadMoreButtonProps {
  onLoadMore: () => void
  loading?: boolean
}

export default function LoadMoreButton({ onLoadMore, loading = false }: LoadMoreButtonProps) {
  return (
    <div className="text-center py-8">
      <button
        onClick={onLoadMore}
        disabled={loading}
        className="btn btn-outline btn-primary px-8 hover:bg-primary hover:text-primary-content transition-colors"
      >
        {loading ? (
          <>
            <span className="loading loading-spinner loading-sm"></span>
            加载中...
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            加载更多
          </>
        )}
      </button>
    </div>
  )
}