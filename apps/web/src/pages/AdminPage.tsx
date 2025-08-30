import NavBar from '../components/NavBar'

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-base-100">
      <NavBar onSearch={() => {}} />
      
      <div className="container mx-auto px-4 py-6">
        <div className="text-center py-16">
          <h1 className="text-3xl font-bold text-slate-800 mb-4">Admin Panel</h1>
          <p className="text-slate-600 mb-8">Management functionality coming soon...</p>
          
          <div className="max-w-md mx-auto">
            <div className="alert alert-warning">
              <svg className="stroke-current shrink-0 w-6 h-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 className="font-bold">Under Development</h3>
                <div className="text-xs">Admin features will be implemented in the next phase</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}