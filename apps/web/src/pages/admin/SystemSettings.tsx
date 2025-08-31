import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../utils/api'
import CategoryIcon from '../../components/CategoryIcon'

interface SystemSettings {
  site: {
    title: string
    description: string
    aboutUrl: string
  }
  content: {
    defaultCategory: string
    itemsPerPage: number
  }
}

interface Category {
  id: number
  name: string
  slug: string
  icon: string
  color?: string
  description?: string
  displayOrder: number
  isActive: number
}

export default function SystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>({
    site: {
      title: '',
      description: '',
      aboutUrl: ''
    },
    content: {
      defaultCategory: '其他',
      itemsPerPage: 20
    }
  })
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategory, setNewCategory] = useState({ name: '', icon: 'folder', color: '#6B7280', description: '' })
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  
  const queryClient = useQueryClient()

  // Fetch settings
  const { data: settingsData, isLoading, error } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const response = await api.getSettings()
      return response.data
    }
  })

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const response = await api.getCategories()
      return response
    }
  })

  // Update local settings when API data is loaded
  useEffect(() => {
    if (settingsData) {
      setSettings(settingsData)
    }
  }, [settingsData])

  // Update categories when API data is loaded
  useEffect(() => {
    if (Array.isArray(categoriesData)) {
      setCategories(categoriesData)
    } else if (categoriesData?.success && categoriesData?.data) {
      setCategories(categoriesData.data)
    }
  }, [categoriesData])

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: SystemSettings) => {
      const response = await api.updateSettings(newSettings)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] })
      showToast('设置保存成功！', 'success')
    }
  })

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: { name: string; icon?: string; color?: string; description?: string }) => {
      const response = await api.createCategory(categoryData.name, categoryData.description, categoryData.icon, categoryData.color)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setNewCategory({ name: '', icon: 'folder', color: '#6B7280', description: '' })
      showToast('分类创建成功！', 'success')
    }
  })

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Category> }) => {
      const response = await api.updateCategory(id, updates)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setEditingCategory(null)
      showToast('分类更新成功！', 'success')
    }
  })

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.deleteCategory(id)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      showToast('分类删除成功！', 'success')
    }
  })

  // Helper function for showing toasts
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const toast = document.createElement('div')
    toast.className = 'toast toast-top toast-end'
    toast.innerHTML = `
      <div class="alert alert-${type}">
        <span>${message}</span>
      </div>
    `
    document.body.appendChild(toast)
    setTimeout(() => document.body.removeChild(toast), 3000)
  }

  const handleSave = () => {
    updateSettingsMutation.mutate(settings)
  }

  const handleAddCategory = () => {
    if (newCategory.name.trim() && !categories.some(cat => cat.name === newCategory.name.trim())) {
      createCategoryMutation.mutate({
        name: newCategory.name.trim(),
        description: newCategory.description.trim() || undefined
      })
    }
  }

  const handleDeleteCategory = (category: Category) => {
    if (category.name === settings.content.defaultCategory) {
      alert('无法删除默认分类。请先设置其他默认分类。')
      return
    }
    
    if (confirm(`确定要删除分类 "${category.name}" 吗？此操作无法撤销。`)) {
      deleteCategoryMutation.mutate(category.id)
    }
  }

  const handleUpdateCategory = (category: Category) => {
    if (editingCategory && editingCategory.id === category.id) {
      updateCategoryMutation.mutate({
        id: category.id,
        updates: {
          name: editingCategory.name.trim(),
          description: editingCategory.description?.trim() || null,
          icon: editingCategory.icon,
          color: editingCategory.color
        }
      })
    }
  }

  const handleStartEditing = (category: Category) => {
    setEditingCategory({ ...category })
  }

  const handleCancelEditing = () => {
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
          <h1 className="text-3xl font-bold text-base-content">系统设置</h1>
          <p className="text-base-content/60 mt-1">配置站点信息和内容设置</p>
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
                正在保存...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                保存所有更改
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
            站点信息
          </h2>
        </div>
        <div className="card-body p-6 pt-4 space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">站点标题</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={settings.site.title}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                site: { ...prev.site, title: e.target.value }
              }))}
              placeholder="您的站点标题"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">站点描述</span>
            </label>
            <textarea
              className="textarea textarea-bordered"
              rows={2}
              value={settings.site.description}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                site: { ...prev.site, description: e.target.value }
              }))}
              placeholder="站点的简要描述"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">关于页面 URL（可选）</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={settings.site.aboutUrl}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                site: { ...prev.site, aboutUrl: e.target.value }
              }))}
              placeholder="/about 或外部URL"
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
            内容设置
          </h2>
        </div>
        <div className="card-body p-6 pt-4 space-y-6">
          {/* Default Category */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">默认分类</span>
            </label>
            <select
              className="select select-bordered"
              value={settings.content.defaultCategory}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                content: { ...prev.content, defaultCategory: e.target.value }
              }))}
            >
              {categories.filter(cat => cat.isActive).map(category => (
                <option key={category.id} value={category.name}>{category.name}</option>
              ))}
            </select>
            <label className="label">
              <span className="label-text-alt text-base-content/50">
                当 AI 无法确定分类时分配给新链接的分类
              </span>
            </label>
          </div>

          {/* Categories Management */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                分类管理
              </span>
            </label>
            
            {/* Existing Categories */}
            <div className="space-y-3 mb-6">
              {categories
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((category) => (
                  <div key={category.id} className="flex items-center gap-3 p-4 bg-base-200/30 rounded-xl border border-base-300/20">
                    {/* Category Icon */}
                    <div className="flex-shrink-0">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: category.color + '15', color: category.color }}
                      >
                        <CategoryIcon icon={category.icon} className="w-5 h-5" />
                      </div>
                    </div>
                    
                    {/* Category Info */}
                    {editingCategory?.id === category.id ? (
                      <div className="flex-1 space-y-3">
                        <input
                          type="text"
                          className="input input-sm input-bordered w-full"
                          value={editingCategory.name}
                          onChange={(e) => setEditingCategory(prev => prev ? { ...prev, name: e.target.value } : null)}
                          placeholder="分类名称"
                        />
                        <input
                          type="text"
                          className="input input-sm input-bordered w-full"
                          value={editingCategory.description || ''}
                          onChange={(e) => setEditingCategory(prev => prev ? { ...prev, description: e.target.value } : null)}
                          placeholder="分类描述（可选）"
                        />
                        
                        {/* Icon Selector */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-base-content/70">图标选择</label>
                          <div className="grid grid-cols-8 gap-2">
                            {['code', 'cube', 'palette', 'wrench', 'folder', 'game-controller', 'book', 'video', 'music', 'photo', 'document', 'globe', 'chat', 'shopping', 'academic'].map((iconName) => (
                              <button
                                key={iconName}
                                type="button"
                                className={`btn btn-xs p-2 ${editingCategory.icon === iconName ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setEditingCategory(prev => prev ? { ...prev, icon: iconName } : null)}
                              >
                                <CategoryIcon icon={iconName} className="w-4 h-4" />
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        {/* Color Selector */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-base-content/70">颜色选择</label>
                          <div className="flex gap-2 flex-wrap">
                            {['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#EF4444', '#6B7280', '#14B8A6', '#F97316', '#8B5CF6'].map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={`w-6 h-6 rounded-full border-2 ${editingCategory.color === color ? 'border-base-content' : 'border-base-300'}`}
                                style={{ backgroundColor: color }}
                                onClick={() => setEditingCategory(prev => prev ? { ...prev, color } : null)}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <div className="font-medium text-base-content flex items-center gap-2">
                          {category.name}
                          {category.name === settings.content.defaultCategory && (
                            <span className="badge badge-primary badge-xs">默认</span>
                          )}
                        </div>
                        {category.description && (
                          <div className="text-sm text-base-content/60 mt-1">
                            {category.description}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex-shrink-0 flex gap-1">
                      {editingCategory?.id === category.id ? (
                        <>
                          <button
                            className="btn btn-success btn-xs"
                            onClick={() => handleUpdateCategory(category)}
                            disabled={updateCategoryMutation.isPending}
                          >
                            保存
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={handleCancelEditing}
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => handleStartEditing(category)}
                          >
                            编辑
                          </button>
                          <button
                            className="btn btn-error btn-outline btn-xs"
                            onClick={() => handleDeleteCategory(category)}
                            disabled={category.name === settings.content.defaultCategory || deleteCategoryMutation.isPending}
                          >
                            删除
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {/* Add New Category */}
            <div className="bg-base-100 p-4 rounded-xl border-2 border-dashed border-base-300">
              <div className="space-y-4">
                <div className="flex gap-3 items-start">
                  {/* Preview */}
                  <div className="flex-shrink-0 pt-2">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: newCategory.color + '15', color: newCategory.color }}
                    >
                      <CategoryIcon icon={newCategory.icon} className="w-5 h-5" />
                    </div>
                  </div>
                  
                  {/* Form */}
                  <div className="flex-1 space-y-3">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        className="input input-bordered flex-1"
                        placeholder="分类名称"
                        value={newCategory.name}
                        onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleAddCategory()
                          }
                        }}
                      />
                      <button
                        className={`btn btn-primary ${createCategoryMutation.isPending ? 'loading' : ''}`}
                        onClick={handleAddCategory}
                        disabled={!newCategory.name.trim() || categories.some(cat => cat.name === newCategory.name.trim()) || createCategoryMutation.isPending}
                      >
                        {createCategoryMutation.isPending ? (
                          '添加中...'
                        ) : (
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            添加分类
                          </span>
                        )}
                      </button>
                    </div>
                    
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      placeholder="分类描述（可选）"
                      value={newCategory.description}
                      onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                    />
                    
                    {/* Icon Selector */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-base-content/70">图标选择</label>
                      <div className="grid grid-cols-8 gap-2">
                        {['code', 'cube', 'palette', 'wrench', 'folder', 'game-controller', 'book', 'video', 'music', 'photo', 'document', 'globe', 'chat', 'shopping', 'academic'].map((iconName) => (
                          <button
                            key={iconName}
                            type="button"
                            className={`btn btn-xs p-2 ${newCategory.icon === iconName ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setNewCategory(prev => ({ ...prev, icon: iconName }))}
                          >
                            <CategoryIcon icon={iconName} className="w-4 h-4" />
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Color Selector */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-base-content/70">颜色选择</label>
                      <div className="flex gap-2 flex-wrap">
                        {['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#EF4444', '#6B7280', '#14B8A6', '#F97316', '#A855F7'].map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`w-6 h-6 rounded-full border-2 ${newCategory.color === color ? 'border-base-content' : 'border-base-300'}`}
                            style={{ backgroundColor: color }}
                            onClick={() => setNewCategory(prev => ({ ...prev, color }))}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items Per Page */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">每页显示数量</span>
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
                主站每页显示的链接数量
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
          <h3 className="font-bold">别忘记保存！</h3>
          <div className="text-xs">点击上方的“保存所有更改”按钮后更改将生效。</div>
        </div>
      </div>
    </div>
  )
}