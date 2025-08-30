export default function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="max-w-md mx-auto">
        <div className="w-24 h-24 mx-auto mb-6 bg-slate-100 rounded-full flex items-center justify-center">
          <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14-7H5m14 14H5" />
          </svg>
        </div>
        
        <h3 className="text-lg font-semibold text-slate-800 mb-2">No links found</h3>
        <p className="text-slate-600 mb-6">
          Get started by adding your first link, or try adjusting your filters.
        </p>
        
        <div className="space-y-2">
          <a 
            href="/admin" 
            className="btn btn-primary bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add First Link
          </a>
          
          <div className="text-sm text-slate-500 mt-4">
            Or use the{' '}
            <button className="text-blue-600 hover:text-blue-800 underline">
              browser extension
            </button>
            {' '}to save links while browsing
          </div>
        </div>
      </div>
    </div>
  )
}