import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface SystemSettings {
  site: {
    title: string
    description: string
    aboutUrl: string
  }
  content: {
    defaultCategory: string
    categories: string[]
    itemsPerPage: number
  }
}

// Mock system settings
const mockSettings: SystemSettings = {
  site: {
    title: 'Magpie - 我的链接收藏',
    description: '收集和分享有趣的链接和内容',
    aboutUrl: '/about'
  },
  content: {
    defaultCategory: '其他',
    categories: ['技术', '产品', '设计', '工具', '其他'],
    itemsPerPage: 20
  }
}

export default function SystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(mockSettings)
  const [newCategory, setNewCategory] = useState('')
  const [editingCategory, setEditingCategory] = useState<{ index: number, value: string } | null>(null)
  
  const queryClient = useQueryClient()

  // Fetch settings
  const { isLoading } = useQuery<SystemSettings>({
    queryKey: ['system-settings'],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 500))
      return mockSettings
    }
  })

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (_newSettings: SystemSettings) => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] })
      // Show success toast
      const toast = document.createElement('div')
      toast.className = 'toast toast-top toast-end'
      toast.innerHTML = `
        <div class="alert alert-success">
          <span>Settings saved successfully!</span>
        </div>
      `
      document.body.appendChild(toast)
      setTimeout(() => document.body.removeChild(toast), 3000)
    }
  })

  const handleSave = () => {
    updateSettingsMutation.mutate(settings)
  }

  const handleAddCategory = () => {
    if (newCategory.trim() && !settings.content.categories.includes(newCategory.trim())) {
      setSettings(prev => ({
        ...prev,
        content: {
          ...prev.content,
          categories: [...prev.content.categories, newCategory.trim()]
        }
      }))
      setNewCategory('')
    }
  }

  const handleDeleteCategory = (index: number) => {
    const categoryToDelete = settings.content.categories[index]
    
    if (categoryToDelete === settings.content.defaultCategory) {
      alert('Cannot delete the default category. Please set a different default category first.')
      return
    }
    
    if (confirm(`Are you sure you want to delete "${categoryToDelete}"? This action cannot be undone.`)) {
      setSettings(prev => ({
        ...prev,
        content: {
          ...prev.content,
          categories: prev.content.categories.filter((_, i) => i !== index)
        }
      }))
    }
  }

  const handleEditCategory = (index: number, newValue: string) => {
    if (newValue.trim()) {
      setSettings(prev => ({
        ...prev,
        content: {
          ...prev.content,
          categories: prev.content.categories.map((cat, i) => 
            i === index ? newValue.trim() : cat
          ),
          defaultCategory: prev.content.defaultCategory === prev.content.categories[index] 
            ? newValue.trim() 
            : prev.content.defaultCategory
        }
      }))
    }
    setEditingCategory(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-base-300 rounded animate-pulse"></div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card bg-base-100 shadow-sm">
            <div className="card-body p-6 animate-pulse">
              <div className="h-6 bg-base-300 rounded w-1/3 mb-4"></div>
              <div className="space-y-3">
                <div className="h-10 bg-base-300 rounded"></div>
                <div className="h-10 bg-base-300 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">System Settings</h1>
          <p className="text-base-content/60 mt-1">Configure site information and content settings</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            className={`btn btn-primary ${updateSettingsMutation.isPending ? 'loading' : ''}`}
            onClick={handleSave}
            disabled={updateSettingsMutation.isPending}
          >
            {updateSettingsMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="loading loading-spinner loading-sm"></span>
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save All Changes
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Site Information */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-header p-6 pb-0">
          <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9-9a9 9 0 00-9 9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            Site Information
          </h2>
        </div>
        <div className="card-body p-6 pt-4 space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Site Title</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={settings.site.title}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                site: { ...prev.site, title: e.target.value }
              }))}
              placeholder="Your site title"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Site Description</span>
            </label>
            <textarea
              className="textarea textarea-bordered"
              rows={2}
              value={settings.site.description}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                site: { ...prev.site, description: e.target.value }
              }))}
              placeholder="Brief description of your site"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">About Page URL (optional)</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={settings.site.aboutUrl}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                site: { ...prev.site, aboutUrl: e.target.value }
              }))}
              placeholder="/about or external URL"
            />
          </div>
        </div>
      </div>

      {/* Content Settings */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-header p-6 pb-0">
          <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8h6m-6 4h6" />
            </svg>
            Content Settings
          </h2>
        </div>
        <div className="card-body p-6 pt-4 space-y-6">
          {/* Default Category */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Default Category</span>
            </label>
            <select
              className="select select-bordered"
              value={settings.content.defaultCategory}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                content: { ...prev.content, defaultCategory: e.target.value }
              }))}
            >
              {settings.content.categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <label className="label">
              <span className="label-text-alt text-base-content/50">
                Category assigned to new links when AI cannot determine a category
              </span>
            </label>
          </div>

          {/* Categories Management */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Category Management</span>
            </label>
            
            {/* Existing Categories */}
            <div className="space-y-2 mb-4">
              {settings.content.categories.map((category, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-base-200/30 rounded-lg">
                  {editingCategory?.index === index ? (
                    <input
                      type="text"
                      className="input input-sm input-bordered flex-1"
                      value={editingCategory.value}
                      onChange={(e) => setEditingCategory({index, value: e.target.value})}
                      onBlur={() => handleEditCategory(index, editingCategory.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleEditCategory(index, editingCategory.value)
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <span className="flex-1 font-medium">
                      • {category}
                      {category === settings.content.defaultCategory && (
                        <span className="badge badge-primary badge-xs ml-2">Default</span>
                      )}
                    </span>
                  )}
                  
                  <div className="flex gap-1">
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => setEditingCategory({index, value: category})}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-error btn-outline btn-xs"
                      onClick={() => handleDeleteCategory(index)}
                      disabled={category === settings.content.defaultCategory}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Category */}
            <div className="flex gap-2">
              <input
                type="text"
                className="input input-bordered flex-1"
                placeholder="New category name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddCategory()
                  }
                }}
              />
              <button
                className="btn btn-primary"
                onClick={handleAddCategory}
                disabled={!newCategory.trim() || settings.content.categories.includes(newCategory.trim())}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </span>
              </button>
            </div>
          </div>

          {/* Items Per Page */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Items Per Page</span>
            </label>
            <div className="flex gap-2">
              {[20, 50, 100].map(count => (
                <button
                  key={count}
                  className={`btn btn-sm ${
                    settings.content.itemsPerPage === count 
                      ? 'btn-primary' 
                      : 'btn-outline'
                  }`}
                  onClick={() => setSettings(prev => ({
                    ...prev,
                    content: { ...prev.content, itemsPerPage: count }
                  }))}
                >
                  {count}
                </button>
              ))}
            </div>
            <label className="label">
              <span className="label-text-alt text-base-content/50">
                Number of links displayed per page on the main site
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Save reminder */}
      <div className="alert alert-info">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h3 className="font-bold">Don't forget to save!</h3>
          <div className="text-xs">Changes will be applied after clicking the "Save All Changes" button above.</div>
        </div>
      </div>
    </div>
  )
}