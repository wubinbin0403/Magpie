export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="loading loading-spinner loading-lg text-blue-600 mb-4"></div>
        <p className="text-slate-500 text-sm">Loading links...</p>
      </div>
    </div>
  )
}