import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../utils/api'
import CategoryIcon from '../../components/CategoryIcon'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Constants
const ICON_OPTIONS = [
  'folder', 'bookmark', 'tag', 'star', 'heart',
  'code', 'globe', 'book', 'image', 'music',
  'video', 'tool', 'game', 'shopping-cart', 'other'
] as const

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
  description?: string
  displayOrder: number
  isActive: number
  count?: number
}

// Sortable Category Item Component
function SortableCategoryItem({ 
  category, 
  isDefault, 
  onEdit, 
  onDelete, 
  isDeleting
}: { 
  category: Category
  isDefault: boolean
  onEdit: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: category.id })
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
  }
  
  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`group relative ${
        isDragging ? 'z-50 opacity-90 shadow-lg' : ''
      }`}
      {...attributes}
    >
      {/* Category Button (Admin style with subtle yellow border) */}
      <button
        className="group relative p-4 rounded-xl transition-all duration-300 hover:shadow-sm hover:bg-magpie-100/10 w-full border border-magpie-100/40 hover:border-magpie-100/60"
        onClick={onEdit}
      >
        {/* Drag handle - only show on hover */}
        <div 
          className="absolute top-2 left-2 opacity-0 group-hover:opacity-60 transition-opacity duration-200 cursor-grab active:cursor-grabbing z-20"
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 6h2v2H8V6zM8 10h2v2H8v-2zM8 14h2v2H8v-2zM14 6h2v2h-2V6zM14 10h2v2h-2v-2zM14 14h2v2h-2v-2z"/>
          </svg>
        </div>
        
        {/* Large background icon (exactly like homepage) */}
        <div className="absolute top-1 left-1 w-12 h-12 flex items-center justify-center">
          <div className="text-gray-400/20 group-hover:text-magpie-200/22 transition-all duration-300">
            <div className="w-10 h-10 flex items-center justify-center">
              <CategoryIcon icon={category.icon} className="w-full h-full" />
            </div>
          </div>
        </div>
        
        {/* Count in top-right corner (like homepage) */}
        <div className="absolute top-2 right-2 z-10">
          <span className="text-xs font-medium text-gray-400 group-hover:text-magpie-200 transition-colors duration-300">
            {category.count || 0}
          </span>
        </div>
        
        {/* Default badge in bottom-right corner with padding */}
        {isDefault && (
          <div className="absolute bottom-2 right-2 z-10">
            <span className="badge badge-primary badge-sm px-3 py-2">默认</span>
          </div>
        )}
        
        {/* Category title centered (exactly like homepage) */}
        <div className="relative z-10 flex items-center justify-center min-h-[50px]">
          <div className="text-lg font-bold text-gray-800 group-hover:text-magpie-300 transition-colors duration-300">
            {category.name}
          </div>
        </div>
        
        {/* Edit icon overlay - bottom right */}
        <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-60 transition-opacity duration-200 z-20">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
      </button>
      
      {/* Quick delete button */}
      {!isDefault && (
        <button
          className="absolute bottom-2 right-2 w-6 h-6 bg-error/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center text-xs hover:scale-110 hover:bg-error z-20"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          disabled={isDeleting}
        >
          ×
        </button>
      )}
    </div>
  )
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
  const [isDragging, setIsDragging] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  
  const queryClient = useQueryClient()
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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
      return response.data
    }
  })
  
  // Fetch links data to get category counts
  const { data: linksData } = useQuery({
    queryKey: ['links-for-categories'],
    queryFn: async () => {
      const response = await api.getLinks({ page: 1, limit: 1 })
      return response.data
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
    if (Array.isArray(categoriesData) && categoriesData.length > 0) {
      // Merge categories with count information from links data
      if (linksData?.filters?.categories) {
        const categoriesWithCounts = categoriesData.map(category => {
          const categoryFilter = linksData.filters.categories.find((f: { name: string; count: number }) => f.name === category.name)
          return {
            ...category,
            count: categoryFilter?.count || 0
          }
        })
        setCategories(categoriesWithCounts)
      } else {
        // Set categories without counts initially
        const categoriesWithDefaultCounts = categoriesData.map(category => ({
          ...category,
          count: 0
        }))
        setCategories(categoriesWithDefaultCounts)
      }
    } else if (Array.isArray(categoriesData)) {
      // Handle empty categories array
      setCategories([])
    }
  }, [categoriesData, linksData])

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
    mutationFn: async (categoryData: { name: string; icon?: string; description?: string }) => {
      const response = await api.createCategory(categoryData.name, categoryData.description, categoryData.icon)
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      showToast('分类创建成功！', 'success')
    }
  })

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Category> }) => {
      const response = await api.updateCategory(id, updates)
      return response
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
  
  // Reorder categories mutation - don't auto-invalidate to avoid state conflicts
  const reorderCategoriesMutation = useMutation({
    mutationFn: async (categoryIds: number[]) => {
      const response = await api.reorderCategories(categoryIds)
      return response.data
    }
    // onSuccess and onError are now handled in handleDragEnd
  })

  // Helper function for showing toasts
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const toast = document.createElement('div')
    toast.className = 'toast toast-top toast-end'
    toast.innerHTML = `
      <div class="alert alert-${type}">
        <span>${message}</span>
      </div>
    `
    document.body.appendChild(toast)
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast)
      }
    }, 3000)
  }, [])

  const handleSave = useCallback(() => {
    updateSettingsMutation.mutate(settings)
  }, [updateSettingsMutation, settings])

  const handleAddCategory = useCallback(async () => {
    if (!editingCategory || !editingCategory.name.trim()) return
    
    try {
      await createCategoryMutation.mutateAsync({
        name: editingCategory.name.trim(),
        description: editingCategory.description?.trim() || undefined,
        icon: editingCategory.icon
      })
      
      setEditingCategory(null)
    } catch (error) {
      console.error('Failed to create category:', error)
    }
  }, [editingCategory, createCategoryMutation])

  const handleDeleteCategory = useCallback((category: Category) => {
    if (category.name === settings.content.defaultCategory) {
      alert('无法删除默认分类。请先设置其他默认分类。')
      return
    }
    
    if (confirm(`确定要删除分类 "${category.name}" 吗？此操作无法撤销。`)) {
      deleteCategoryMutation.mutate(category.id)
    }
  }, [settings.content.defaultCategory, deleteCategoryMutation])

  const handleUpdateCategory = useCallback(async (originalCategory: Category) => {
    if (!editingCategory) return
    
    try {
      await updateCategoryMutation.mutateAsync({
        id: originalCategory.id,
        name: editingCategory.name.trim(),
        description: editingCategory.description?.trim() || undefined,
        icon: editingCategory.icon
      })
      
      setEditingCategory(null)
    } catch (error) {
      console.error('Failed to update category:', error)
    }
  }, [editingCategory, updateCategoryMutation])

  // handleStartEditing and handleCancelEditing removed as they're now handled by setEditingCategory directly
  
  const handleDragStart = useCallback(() => {
    setIsDragging(true)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    
    if (active.id !== over?.id && over?.id && categories.length > 1) {
      // Use sorted categories as base to ensure consistent ordering
      const sortedCategories = [...categories].sort((a, b) => a.displayOrder - b.displayOrder)
      const oldIndex = sortedCategories.findIndex(c => c.id === active.id)
      const newIndex = sortedCategories.findIndex(c => c.id === over?.id)
      
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        // Create new order with arrayMove
        const newOrder = arrayMove(sortedCategories, oldIndex, newIndex)
        
        // Update local state with new display orders
        const updatedCategories = newOrder.map((category, index) => ({
          ...category,
          displayOrder: index
        }))
        
        setCategories(updatedCategories)
        
        // Extract just the IDs in the new order for the API call
        const categoryIds = newOrder.map(c => c.id)
        
        // Call reorder API but don't invalidate queries to avoid conflicting updates
        reorderCategoriesMutation.mutate(categoryIds, {
          onSuccess: () => {
            // Only show toast, don't refetch data to avoid state conflicts
            showToast('分类顺序已更新！', 'success')
          },
          onError: () => {
            // Revert local state on error
            queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
            showToast('排序失败，已恢复原顺序', 'error')
          }
        })
      }
    }
    
    // Always reset dragging state after processing
    setIsDragging(false)
  }, [categories, reorderCategoriesMutation, queryClient])

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
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={categories.sort((a, b) => a.displayOrder - b.displayOrder).map(c => c.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                  {categories
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map((category) => (
                      <SortableCategoryItem 
                        key={category.id}
                        category={category}
                        isDefault={category.name === settings.content.defaultCategory}
                        onEdit={() => setEditingCategory(category)}
                        onDelete={() => handleDeleteCategory(category)}
                        isDeleting={deleteCategoryMutation.isPending}
                      />
                    ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Add New Category Button */}
            <button
              className="group relative p-4 rounded-xl border-2 border-dashed border-base-300 hover:border-primary/50 transition-all duration-300 w-full flex flex-col items-center justify-center min-h-[120px] hover:bg-base-200/30"
              onClick={() => setEditingCategory({
                id: 0,
                name: '',
                slug: '',
                icon: 'folder',
                description: '',
                displayOrder: categories.length > 0 ? Math.max(...categories.map(c => c.displayOrder), 0) + 1 : 0,
                isActive: 1
              } as Category)}
            >
              <div className="w-12 h-12 rounded-full border-2 border-dashed border-base-300 group-hover:border-primary/50 flex items-center justify-center mb-2 transition-colors duration-300">
                <svg className="w-6 h-6 text-base-content/50 group-hover:text-primary/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-sm font-medium text-base-content/70 group-hover:text-primary/70 transition-colors duration-300">
                添加分类
              </span>
            </button>
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
          <div className="text-xs">点击上方的"保存所有更改"按钮后更改将生效。</div>
        </div>
      </div>

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl h-full max-h-screen overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg">
                {editingCategory.id === 0 ? '添加新分类' : '编辑分类'}
              </h3>
              <button
                className="btn btn-sm btn-circle btn-ghost"
                onClick={() => setEditingCategory(null)}
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6">
              {/* Preview Section */}
              <div className="bg-base-200/30 p-4 rounded-xl">
                <h4 className="font-semibold mb-3 text-sm text-base-content/70">预览效果</h4>
                <div className="w-48">
                  <div className="group relative p-4 rounded-xl border border-magpie-100/40 hover:border-magpie-100/60 transition-all duration-300 hover:bg-magpie-100/10">
                    {/* Background icon */}
                    <div className="absolute top-1 left-1 w-12 h-12 flex items-center justify-center">
                      <div className="text-gray-400/20 group-hover:text-magpie-200/22 transition-all duration-300">
                        <div className="w-10 h-10 flex items-center justify-center">
                          <CategoryIcon icon={editingCategory.icon || 'folder'} className="w-full h-full" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Count in top-right */}
                    <div className="absolute top-2 right-2">
                      <span className="text-xs font-medium text-gray-400 group-hover:text-magpie-200 transition-colors duration-300">
                        0
                      </span>
                    </div>
                    
                    {/* Title centered */}
                    <div className="relative z-10 flex items-center justify-center min-h-[50px]">
                      <div className="text-lg font-bold text-gray-800 group-hover:text-magpie-300 transition-colors duration-300">
                        {editingCategory.name || '分类名称'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">分类名称 *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="输入分类名称"
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">描述（可选）</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered"
                    rows={2}
                    value={editingCategory.description || ''}
                    onChange={(e) => setEditingCategory(prev => prev ? { ...prev, description: e.target.value } : null)}
                    placeholder="分类的简要描述"
                  />
                </div>

                {/* Icon Selection */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">图标</span>
                  </label>
                  <div className="grid grid-cols-5 gap-3">
                    {ICON_OPTIONS.map((iconName) => (
                      <button
                        key={iconName}
                        type="button"
                        className={`p-3 rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
                          editingCategory.icon === iconName
                            ? 'border-primary bg-primary/10'
                            : 'border-base-300 hover:border-primary/50'
                        }`}
                        onClick={() => setEditingCategory(prev => prev ? { ...prev, icon: iconName } : null)}
                      >
                        <CategoryIcon icon={iconName} className="w-8 h-8 mx-auto" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-base-300">
              <button
                className="btn btn-outline"
                onClick={() => setEditingCategory(null)}
              >
                取消
              </button>
              <button
                className={`btn btn-primary ${
                  (createCategoryMutation.isPending || updateCategoryMutation.isPending) ? 'loading' : ''
                }`}
                onClick={() => {
                  if (editingCategory.id === 0) {
                    handleAddCategory()
                  } else {
                    const originalCategory = categories.find(c => c.id === editingCategory.id)
                    if (originalCategory) {
                      handleUpdateCategory(originalCategory)
                    }
                  }
                }}
                disabled={
                  !editingCategory.name.trim() || 
                  createCategoryMutation.isPending || 
                  updateCategoryMutation.isPending
                }
              >
                {editingCategory.id === 0 ? '添加分类' : '保存更改'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}