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
        className="btn btn-outline btn-primary bg-white hover:bg-blue-50 border-blue-200 hover:border-blue-400 text-blue-700 hover:text-blue-800 px-8"
      >
        {loading ? (
          <>
            <span className="loading loading-spinner loading-sm mr-2"></span>
            Loading...
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