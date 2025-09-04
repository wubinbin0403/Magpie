import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LinkEditForm from '../components/LinkEditForm'

describe('LinkEditForm', () => {
  const defaultProps = {
    initialData: {
      title: 'Test Article',
      description: 'Test description',
      category: 'Technology',
      tags: ['react', 'testing'],
      status: 'published' as const
    },
    categories: [
      { id: 1, name: 'Technology' },
      { id: 2, name: 'Design' },
      { id: 3, name: 'Business' }
    ],
    onSave: vi.fn(),
    onCancel: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render form title', () => {
      render(<LinkEditForm {...defaultProps} />)
      
      expect(screen.getByText('编辑链接信息')).toBeInTheDocument()
    })

    it('should render all form fields', () => {
      render(<LinkEditForm {...defaultProps} />)
      
      expect(screen.getByText('标题 *')).toBeInTheDocument()
      expect(screen.getByText('描述 *')).toBeInTheDocument()
      expect(screen.getByText('分类')).toBeInTheDocument()
      expect(screen.getByText('标签')).toBeInTheDocument()
      
      // Check for actual form controls
      expect(screen.getByPlaceholderText('链接标题')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('链接描述或摘要')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Technology')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('标签1, 标签2, 标签3')).toBeInTheDocument()
    })

    it('should render action buttons', () => {
      render(<LinkEditForm {...defaultProps} />)
      
      expect(screen.getByRole('button', { name: /保存/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /取消/ })).toBeInTheDocument()
    })

    it('should populate form with initial data', () => {
      render(<LinkEditForm {...defaultProps} />)
      
      expect(screen.getByDisplayValue('Test Article')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Test description')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Technology')).toBeInTheDocument()
      expect(screen.getByDisplayValue('react, testing')).toBeInTheDocument()
    })
  })

  describe('Status Field', () => {
    it('should show status field when showStatus is true', () => {
      render(<LinkEditForm {...defaultProps} showStatus={true} />)
      
      expect(screen.getByText('状态')).toBeInTheDocument()
      const statusSelect = screen.getByDisplayValue('已发布')
      expect(statusSelect).toHaveValue('published')
    })

    it('should not show status field when showStatus is false', () => {
      render(<LinkEditForm {...defaultProps} showStatus={false} />)
      
      expect(screen.queryByLabelText(/状态/)).not.toBeInTheDocument()
    })

    it('should have correct status options', () => {
      render(<LinkEditForm {...defaultProps} showStatus={true} />)
      
      const statusSelect = screen.getByDisplayValue('已发布')
      expect(statusSelect).toHaveValue('published')
      
      // Check all options are present
      expect(screen.getByRole('option', { name: '已发布' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '待审核' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '已删除' })).toBeInTheDocument()
    })
  })

  describe('Form Interaction', () => {
    it('should update title field', async () => {
      const user = userEvent.setup()
      render(<LinkEditForm {...defaultProps} />)
      
      const titleInput = screen.getByPlaceholderText('链接标题')
      await user.clear(titleInput)
      await user.type(titleInput, 'New Title')
      
      expect(screen.getByDisplayValue('New Title')).toBeInTheDocument()
    })

    it('should update description field', async () => {
      const user = userEvent.setup()
      render(<LinkEditForm {...defaultProps} />)
      
      const descriptionTextarea = screen.getByPlaceholderText('链接描述或摘要')
      await user.clear(descriptionTextarea)
      await user.type(descriptionTextarea, 'New description')
      
      expect(screen.getByDisplayValue('New description')).toBeInTheDocument()
    })

    it('should update category field', async () => {
      const user = userEvent.setup()
      render(<LinkEditForm {...defaultProps} />)
      
      const categorySelect = screen.getByDisplayValue('Technology')
      await user.selectOptions(categorySelect, 'Design')
      
      expect(screen.getByDisplayValue('Design')).toBeInTheDocument()
    })

    it('should update tags field', async () => {
      const user = userEvent.setup()
      render(<LinkEditForm {...defaultProps} />)
      
      const tagsInput = screen.getByPlaceholderText('标签1, 标签2, 标签3')
      
      // Use fireEvent for more reliable tag input
      fireEvent.change(tagsInput, { target: { value: 'vue, javascript, frontend' } })
      
      expect(screen.getByDisplayValue('vue, javascript, frontend')).toBeInTheDocument()
    })

    it('should update status field when enabled', async () => {
      const user = userEvent.setup()
      render(<LinkEditForm {...defaultProps} showStatus={true} />)
      
      const statusSelect = screen.getByDisplayValue('已发布')
      await user.selectOptions(statusSelect, 'pending')
      
      expect(statusSelect).toHaveValue('pending')
    })
  })

  describe('Form Submission', () => {
    it('should call onSave with correct data when form is submitted', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      
      render(<LinkEditForm {...defaultProps} onSave={onSave} />)
      
      const saveButton = screen.getByRole('button', { name: /保存/ })
      await user.click(saveButton)
      
      expect(onSave).toHaveBeenCalledWith({
        title: 'Test Article',
        description: 'Test description',
        category: 'Technology',
        tags: ['react', 'testing'],
        status: 'published'
      })
    })

    it('should call onSave with updated data after form changes', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      
      render(<LinkEditForm {...defaultProps} onSave={onSave} />)
      
      // Update form fields
      const titleInput = screen.getByPlaceholderText('链接标题')
      await user.clear(titleInput)
      await user.type(titleInput, 'Updated Title')
      
      const descriptionTextarea = screen.getByPlaceholderText('链接描述或摘要')
      await user.clear(descriptionTextarea)
      await user.type(descriptionTextarea, 'Updated description')
      
      const categorySelect = screen.getByDisplayValue('Technology')
      await user.selectOptions(categorySelect, 'Design')
      
      const tagsInput = screen.getByPlaceholderText('标签1, 标签2, 标签3')
      await user.clear(tagsInput)
      fireEvent.change(tagsInput, { target: { value: 'new, tags' } })
      
      const saveButton = screen.getByRole('button', { name: /保存/ })
      await user.click(saveButton)
      
      expect(onSave).toHaveBeenCalledWith({
        title: 'Updated Title',
        description: 'Updated description',
        category: 'Design',
        tags: ['new', 'tags'],
        status: 'published'
      })
    })

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()
      
      render(<LinkEditForm {...defaultProps} onCancel={onCancel} />)
      
      const cancelButton = screen.getByRole('button', { name: /取消/ })
      await user.click(cancelButton)
      
      expect(onCancel).toHaveBeenCalled()
    })
  })

  describe('Form Validation', () => {
    it('should show alert when title is empty', async () => {
      const user = userEvent.setup()
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
      
      render(<LinkEditForm {...defaultProps} />)
      
      const titleInput = screen.getByPlaceholderText('链接标题')
      await user.clear(titleInput)
      
      const saveButton = screen.getByRole('button', { name: /保存/ })
      await user.click(saveButton)
      
      expect(alertSpy).toHaveBeenCalledWith('请填写标题')
      
      alertSpy.mockRestore()
    })

    it('should show alert when description is empty', async () => {
      const user = userEvent.setup()
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
      
      render(<LinkEditForm {...defaultProps} />)
      
      const descriptionTextarea = screen.getByPlaceholderText('链接描述或摘要')
      await user.clear(descriptionTextarea)
      
      const saveButton = screen.getByRole('button', { name: /保存/ })
      await user.click(saveButton)
      
      expect(alertSpy).toHaveBeenCalledWith('请填写描述')
      
      alertSpy.mockRestore()
    })

    it('should not call onSave when validation fails', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
      
      render(<LinkEditForm {...defaultProps} onSave={onSave} />)
      
      const titleInput = screen.getByPlaceholderText('链接标题')
      await user.clear(titleInput)
      
      const saveButton = screen.getByRole('button', { name: /保存/ })
      await user.click(saveButton)
      
      expect(onSave).not.toHaveBeenCalled()
      
      alertSpy.mockRestore()
    })
  })

  describe('Loading State', () => {
    it('should show loading state on save button when isLoading is true', () => {
      render(<LinkEditForm {...defaultProps} isLoading={true} />)
      
      const saveButton = screen.getByRole('button', { name: /保存中/ })
      expect(saveButton).toBeInTheDocument()
      expect(saveButton).toBeDisabled()
    })

    it('should disable cancel button when isLoading is true', () => {
      render(<LinkEditForm {...defaultProps} isLoading={true} />)
      
      const cancelButton = screen.getByRole('button', { name: /取消/ })
      expect(cancelButton).toBeDisabled()
    })

    it('should show loading spinner when isLoading is true', () => {
      render(<LinkEditForm {...defaultProps} isLoading={true} />)
      
      expect(screen.getByText('保存中...')).toBeInTheDocument()
    })
  })

  describe('Compact Mode', () => {
    it('should apply compact styling when compact is true', () => {
      render(<LinkEditForm {...defaultProps} compact={true} />)
      
      // Check for compact class on form elements
      const titleInput = screen.getByPlaceholderText('链接标题')
      expect(titleInput).toHaveClass('input-sm')
      
      const categorySelect = screen.getByDisplayValue('Technology')
      expect(categorySelect).toHaveClass('select-sm')
      
      const saveButton = screen.getByRole('button', { name: /保存/ })
      expect(saveButton).toHaveClass('btn-sm')
    })
  })

  describe('Custom Props', () => {
    it('should use custom button text', () => {
      render(
        <LinkEditForm 
          {...defaultProps} 
          saveButtonText="发布" 
          cancelButtonText="放弃"
        />
      )
      
      expect(screen.getByRole('button', { name: /发布/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /放弃/ })).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(
        <LinkEditForm {...defaultProps} className="custom-class" />
      )
      
      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('Tags Processing', () => {
    it('should parse tags correctly from string', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      
      render(<LinkEditForm {...defaultProps} onSave={onSave} />)
      
      const tagsInput = screen.getByPlaceholderText('标签1, 标签2, 标签3')
      await user.clear(tagsInput)
      fireEvent.change(tagsInput, { target: { value: '  tag1  ,  tag2,tag3   ,  ' } })
      
      const saveButton = screen.getByRole('button', { name: /保存/ })
      await user.click(saveButton)
      
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['tag1', 'tag2', 'tag3']
        })
      )
    })

    it('should handle empty tags string', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      
      render(<LinkEditForm {...defaultProps} onSave={onSave} />)
      
      const tagsInput = screen.getByPlaceholderText('标签1, 标签2, 标签3')
      await user.clear(tagsInput)
      
      const saveButton = screen.getByRole('button', { name: /保存/ })
      await user.click(saveButton)
      
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: []
        })
      )
    })
  })

  describe('Initial Data Updates', () => {
    it('should update form when initial data changes', () => {
      const { rerender } = render(<LinkEditForm {...defaultProps} />)
      
      expect(screen.getByDisplayValue('Test Article')).toBeInTheDocument()
      
      const newInitialData = {
        title: 'Updated Article',
        description: 'Updated description',
        category: 'Design',
        tags: ['vue', 'ui'],
        status: 'pending' as const
      }
      
      rerender(<LinkEditForm {...defaultProps} initialData={newInitialData} />)
      
      expect(screen.getByDisplayValue('Updated Article')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Updated description')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Design')).toBeInTheDocument()
      expect(screen.getByDisplayValue('vue, ui')).toBeInTheDocument()
    })
  })

  describe('Categories Integration', () => {
    it('should render all categories in select', () => {
      render(<LinkEditForm {...defaultProps} />)
      
      expect(screen.getByRole('option', { name: 'Technology' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Design' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Business' })).toBeInTheDocument()
    })

    it('should have empty option for category select', () => {
      render(<LinkEditForm {...defaultProps} />)
      
      expect(screen.getByRole('option', { name: '选择分类' })).toBeInTheDocument()
    })
  })
})