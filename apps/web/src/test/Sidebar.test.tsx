import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sidebar from '../components/Sidebar'

// Mock CategoryIcon component
vi.mock('../components/CategoryIcon', () => ({
  default: ({ icon, className }: { icon: string; className: string }) => (
    <div data-testid={`category-icon-${icon}`} className={className}>
      {icon}
    </div>
  )
}))

describe('Sidebar', () => {
  const mockCategories = [
    {
      id: 1,
      name: '技术',
      slug: 'tech',
      icon: 'code',
      description: 'Technology content',
      displayOrder: 1,
      count: 8
    },
    {
      id: 2,
      name: '设计',
      slug: 'design',
      icon: 'palette',
      description: 'Design content',
      displayOrder: 2,
      count: 3
    },
    {
      id: 3,
      name: '工具',
      slug: 'tools',
      icon: 'wrench',
      description: 'Tools and utilities',
      displayOrder: 3,
      count: 4
    }
  ]

  const mockTags = [
    { name: 'javascript', count: 8 },
    { name: 'react', count: 6 },
    { name: 'vue', count: 11 },
    { name: 'typescript', count: 7 },
    { name: 'css', count: 14 },
    { name: 'html', count: 16 },
    { name: 'nodejs', count: 9 },
    { name: 'python', count: 18 },
    { name: 'design', count: 12 },
    { name: 'ui', count: 15 },
    { name: 'ux', count: 17 },
    { name: 'figma', count: 13 },
    { name: 'photoshop', count: 19 },
    { name: 'sketch', count: 1 }
  ]

  const defaultProps = {
    categories: mockCategories,
    tags: mockTags,
    selectedCategory: null,
    selectedTags: [],
    onCategoryFilter: vi.fn(),
    onTagFilter: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Categories Section', () => {
    it('should render all categories with correct structure', () => {
      render(<Sidebar {...defaultProps} />)

      // Check "All" button
      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByTestId('category-icon-folder')).toBeInTheDocument()

      // Check individual categories
      expect(screen.getByText('技术')).toBeInTheDocument()
      expect(screen.getByTestId('category-icon-code')).toBeInTheDocument()
      
      expect(screen.getByText('设计')).toBeInTheDocument()
      expect(screen.getByTestId('category-icon-palette')).toBeInTheDocument()
      
      expect(screen.getByText('工具')).toBeInTheDocument()
      expect(screen.getByTestId('category-icon-wrench')).toBeInTheDocument()
    })

    it('should display correct total count for "All" category', () => {
      render(<Sidebar {...defaultProps} />)
      
      const totalCount = mockCategories.reduce((sum, cat) => sum + cat.count, 0) // Should be 10
      // Use more specific selector to find the total count in the "All" category button
      const allButton = screen.getByText('All').closest('button')
      expect(allButton).toContainElement(screen.getAllByText(totalCount.toString())[0])
    })

    it('should highlight selected category', () => {
      render(<Sidebar {...defaultProps} selectedCategory="技术" />)
      
      const techCategory = screen.getByText('技术').closest('button')
      expect(techCategory).toHaveClass('bg-magpie-200/10')
    })

    it('should highlight "All" when no category is selected', () => {
      render(<Sidebar {...defaultProps} selectedCategory={null} />)
      
      const allCategory = screen.getByText('All').closest('button')
      expect(allCategory).toHaveClass('bg-magpie-200/10')
    })

    it('should call onCategoryFilter when category is clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      await user.click(screen.getByText('技术'))
      expect(defaultProps.onCategoryFilter).toHaveBeenCalledWith('技术')
    })

    it('should call onCategoryFilter with null when "All" is clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      await user.click(screen.getByText('All'))
      expect(defaultProps.onCategoryFilter).toHaveBeenCalledWith(null)
    })

    it('should trigger hover animations on category hover', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const categoryButton = screen.getByText('技术').closest('button')
      await user.hover(categoryButton!)

      // The component should have triggered the hover handler
      // We can't easily test the random animation assignment, but we can verify
      // the component structure remains intact after hover
      expect(screen.getByText('技术')).toBeInTheDocument()
    })

    it('should hide categories with zero count', () => {
      const categoriesWithZeros = [
        ...mockCategories,
        {
          id: 4,
          name: '空分类',
          slug: 'empty',
          icon: 'folder',
          description: 'Empty category',
          displayOrder: 4,
          count: 0
        }
      ]
      
      render(<Sidebar {...defaultProps} categories={categoriesWithZeros} />)
      
      // Should show categories with count > 0
      expect(screen.getByText('技术')).toBeInTheDocument()
      expect(screen.getByText('设计')).toBeInTheDocument()
      expect(screen.getByText('工具')).toBeInTheDocument()
      
      // Should NOT show category with count = 0
      expect(screen.queryByText('空分类')).not.toBeInTheDocument()
      
      // All button should still be present
      expect(screen.getByText('All')).toBeInTheDocument()
    })
  })

  describe('Tags Section', () => {
    it('should render tags section with correct title', () => {
      render(<Sidebar {...defaultProps} />)
      
      expect(screen.getByText('热门标签')).toBeInTheDocument()
    })

    it('should display first 12 tags by default', () => {
      render(<Sidebar {...defaultProps} />)
      
      // Should show first 12 tags by name
      const visibleTags = mockTags.slice(0, 12)
      visibleTags.forEach(tag => {
        expect(screen.getByText(`#${tag.name}`)).toBeInTheDocument()
      })

      // Should not show tags beyond 12
      const hiddenTag = mockTags[13]
      if (hiddenTag) {
        expect(screen.queryByText(`#${hiddenTag.name}`)).not.toBeInTheDocument()
      }
    })

    it('should show expand/collapse button when more than 12 tags', () => {
      render(<Sidebar {...defaultProps} />)
      
      expect(screen.getByText('显示所有')).toBeInTheDocument()
    })

    it('should expand tags when expand button is clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      await user.click(screen.getByText('显示所有'))

      // Should show all tags now
      mockTags.forEach(tag => {
        expect(screen.getByText(`#${tag.name}`)).toBeInTheDocument()
      })

      // Button should change to collapse
      expect(screen.getByText('收起标签')).toBeInTheDocument()
    })

    it('should collapse tags when collapse button is clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      // Expand first
      await user.click(screen.getByText('显示所有'))
      expect(screen.getByText('收起标签')).toBeInTheDocument()

      // Then collapse
      await user.click(screen.getByText('收起标签'))
      expect(screen.getByText('显示所有')).toBeInTheDocument()

      // Should only show first 12 tags again
      const hiddenTag = mockTags[13]
      if (hiddenTag) {
        expect(screen.queryByText(`#${hiddenTag.name}`)).not.toBeInTheDocument()
      }
    })

    it('should highlight selected tags', () => {
      render(<Sidebar {...defaultProps} selectedTags={['javascript', 'react']} />)
      
      const jsTag = screen.getByText('#javascript').closest('button')
      const reactTag = screen.getByText('#react').closest('button')
      
      expect(jsTag).toHaveClass('bg-primary/15', 'text-primary', 'border-primary/30')
      expect(reactTag).toHaveClass('bg-primary/15', 'text-primary', 'border-primary/30')
    })

    it('should call onTagFilter when tag is clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      await user.click(screen.getByText('#javascript'))
      expect(defaultProps.onTagFilter).toHaveBeenCalledWith('javascript')
    })

    it('should show selected tags that are not in visible range', () => {
      // Create a scenario where a selected tag is outside the first 12
      const selectedTags = ['photoshop'] // This is index 12, outside first 12
      
      render(<Sidebar {...defaultProps} selectedTags={selectedTags} />)
      
      // Should show the selected tag even though it's outside the first 12
      expect(screen.getByText('#photoshop')).toBeInTheDocument()
    })

    it('should handle selected tags that do not exist in the tags list', () => {
      const selectedTags = ['nonexistent-tag']
      
      render(<Sidebar {...defaultProps} selectedTags={selectedTags} />)
      
      // Should show the tag with count 0
      expect(screen.getByText('#nonexistent-tag')).toBeInTheDocument()
      expect(screen.getByText('•')).toBeInTheDocument() // Special indicator for 0 count selected tags
    })

    it('should not show expand button when tags are 12 or fewer', () => {
      const shortTagsList = mockTags.slice(0, 10)
      render(<Sidebar {...defaultProps} tags={shortTagsList} />)
      
      expect(screen.queryByText('显示所有')).not.toBeInTheDocument()
    })
  })

  describe('Layout and Structure', () => {
    it('should have proper layout structure', () => {
      render(<Sidebar {...defaultProps} />)
      
      // Main container
      const container = screen.getByText('All').closest('.flex.flex-col.h-full')
      expect(container).toBeInTheDocument()
      
      // Categories grid
      const categoriesGrid = screen.getByText('All').closest('.grid.grid-cols-2')
      expect(categoriesGrid).toBeInTheDocument()
    })

    it('should handle empty categories list', () => {
      render(<Sidebar {...defaultProps} categories={[]} />)
      
      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('0')).toBeInTheDocument() // Total count should be 0
    })

    it('should handle empty tags list', () => {
      render(<Sidebar {...defaultProps} tags={[]} />)
      
      expect(screen.getByText('热门标签')).toBeInTheDocument()
      expect(screen.queryByText('显示所有')).not.toBeInTheDocument()
    })

    it('should maintain responsive behavior', () => {
      render(<Sidebar {...defaultProps} />)
      
      // Check grid layout classes
      const grid = screen.getByText('All').closest('.grid-cols-2')
      expect(grid).toHaveClass('grid', 'grid-cols-2', 'gap-3')
    })
  })

  describe('Accessibility', () => {
    it('should have proper button roles', () => {
      render(<Sidebar {...defaultProps} />)
      
      // All category buttons should be clickable
      const allButton = screen.getByText('All').closest('button')
      expect(allButton).toBeInTheDocument()
      
      mockCategories.forEach(category => {
        const button = screen.getByText(category.name).closest('button')
        expect(button).toBeInTheDocument()
      })
    })

    it('should have proper tag button roles', () => {
      render(<Sidebar {...defaultProps} />)
      
      mockTags.slice(0, 12).forEach(tag => {
        const button = screen.getByText(`#${tag.name}`).closest('button')
        expect(button).toBeInTheDocument()
      })
    })
  })
})