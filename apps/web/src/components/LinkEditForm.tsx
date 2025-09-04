import { useState, useEffect } from 'react'

interface LinkEditFormData {
  title: string
  description: string
  category: string
  tags: string[]
  status?: 'published' | 'pending' | 'deleted'
}

interface LinkEditFormProps {
  initialData: LinkEditFormData
  categories: Array<{ id: number | string; name: string }>
  onSave: (data: LinkEditFormData) => void
  onCancel: () => void
  isLoading?: boolean
  showStatus?: boolean
  saveButtonText?: string
  cancelButtonText?: string
  className?: string
  compact?: boolean
}

export default function LinkEditForm({
  initialData,
  categories,
  onSave,
  onCancel,
  isLoading = false,
  showStatus = false,
  saveButtonText = '保存',
  cancelButtonText = '取消',
  className = '',
  compact = false
}: LinkEditFormProps) {
  const [formData, setFormData] = useState<LinkEditFormData>(initialData)

  // Update form data when initial data changes
  useEffect(() => {
    setFormData(initialData)
  }, [initialData])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!formData.title.trim()) {
      alert('请填写标题')
      return
    }
    
    if (!formData.description.trim()) {
      alert('请填写描述')
      return
    }
    
    onSave(formData)
  }

  // Tag string conversion helpers
  const getTagsString = () => formData.tags.join(', ')
  
  const handleTagsChange = (tagsString: string) => {
    const tags = tagsString
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
    setFormData(prev => ({ ...prev, tags }))
  }

  const inputSize = compact ? 'input-sm' : ''
  const selectSize = compact ? 'select-sm' : ''
  const textareaSize = compact ? 'textarea-sm' : ''
  const buttonSize = compact ? 'btn-sm' : ''
  const labelSize = compact ? 'text-xs' : 'text-sm'
  const textareaHeight = compact ? 'h-16' : 'h-20'

  return (
    <div className={`space-y-4 p-4 bg-base-200/30 rounded-lg border border-base-300/20 ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h4 className={`font-medium text-base-content ${compact ? 'text-sm' : ''}`}>
          编辑链接信息
        </h4>
        
        {/* Title */}
        <div className="form-control">
          <label className="label py-1">
            <span className={`label-text ${labelSize}`}>标题 *</span>
          </label>
          <input
            type="text"
            className={`input input-bordered ${inputSize}`}
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="链接标题"
          />
        </div>

        {/* Description */}
        <div className="form-control">
          <label className="label py-1">
            <span className={`label-text ${labelSize}`}>描述 *</span>
          </label>
          <textarea
            className={`textarea textarea-bordered ${textareaSize} ${textareaHeight}`}
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="链接描述或摘要"
          />
        </div>

        {/* Category and Status Row */}
        <div className={`grid ${showStatus ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-3`}>
          {/* Category */}
          <div className="form-control">
            <label className="label py-1">
              <span className={`label-text ${labelSize}`}>分类</span>
            </label>
            <select
              className={`select select-bordered ${selectSize}`}
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            >
              <option value="">选择分类</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status (if enabled) */}
          {showStatus && (
            <div className="form-control">
              <label className="label py-1">
                <span className={`label-text ${labelSize}`}>状态</span>
              </label>
              <select
                className={`select select-bordered ${selectSize}`}
                value={formData.status || 'published'}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  status: e.target.value as 'published' | 'pending' | 'deleted'
                }))}
              >
                <option value="published">已发布</option>
                <option value="pending">待审核</option>
                <option value="deleted">已删除</option>
              </select>
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="form-control">
          <label className="label py-1">
            <span className={`label-text ${labelSize}`}>标签</span>
          </label>
          <input
            type="text"
            className={`input input-bordered ${inputSize}`}
            value={getTagsString()}
            onChange={(e) => handleTagsChange(e.target.value)}
            placeholder="标签1, 标签2, 标签3"
          />
          <label className="label py-1">
            <span className="label-text-alt text-xs text-base-content/50">
              多个标签用逗号分隔
            </span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <button 
            type="submit"
            className={`btn btn-success ${buttonSize} ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                保存中...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {saveButtonText}
              </>
            )}
          </button>
          <button 
            type="button"
            className={`btn btn-ghost ${buttonSize}`}
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelButtonText}
          </button>
        </div>
      </form>
    </div>
  )
}