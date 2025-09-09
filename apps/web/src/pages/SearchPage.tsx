import NavBar from '../components/NavBar'

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-base-100">
      <NavBar 
        onSearch={() => {}} 
        categories={[]}
        selectedCategory={null}
        onCategoryFilter={() => {}}
      />
      
      <div className="container mx-auto px-4 py-6">
        <div className="text-center py-16">
          <h1 className="text-3xl font-bold text-slate-800 mb-4">Search Page</h1>
          <p className="text-slate-600">Advanced search functionality coming soon...</p>
        </div>
      </div>
    </div>
  )
}