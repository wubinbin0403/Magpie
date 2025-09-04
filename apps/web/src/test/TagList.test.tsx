import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TagList from '../components/TagList'

describe('TagList', () => {
  const defaultProps = {
    tags: ['javascript', 'react', 'testing'],
    onTagClick: vi.fn(),
    selectedTags: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render all tags when under maxVisible limit', () => {
      render(<TagList {...defaultProps} />)
      
      expect(screen.getByText('#javascript')).toBeInTheDocument()
      expect(screen.getByText('#react')).toBeInTheDocument()
      expect(screen.getByText('#testing')).toBeInTheDocument()
    })

    it('should render empty list gracefully', () => {
      render(<TagList tags={[]} onTagClick={vi.fn()} selectedTags={[]} />)
      
      expect(screen.queryByText(/#/)).not.toBeInTheDocument()
    })

    it('should handle undefined tags', () => {
      render(<TagList tags={undefined as any} onTagClick={vi.fn()} selectedTags={[]} />)
      
      expect(screen.queryByText(/#/)).not.toBeInTheDocument()
    })
  })

  describe('Tag Limiting and More Button', () => {
    const manyTags = ['javascript', 'react', 'testing', 'frontend', 'backend', 'nodejs', 'typescript']

    it('should show "+X more" indicator when tags exceed maxVisible', () => {
      render(<TagList tags={manyTags} maxVisible={3} onTagClick={vi.fn()} selectedTags={[]} />)
      
      // Should show first 3 tags
      expect(screen.getByText('#javascript')).toBeInTheDocument()
      expect(screen.getByText('#react')).toBeInTheDocument()
      expect(screen.getByText('#testing')).toBeInTheDocument()
      
      // Should show "+X more" indicator
      expect(screen.getByText('+4 more')).toBeInTheDocument()
      
      // Should not show remaining tags initially
      expect(screen.queryByText('#frontend')).not.toBeInTheDocument()
      expect(screen.queryByText('#backend')).not.toBeInTheDocument()
    })

    it('should show tooltip with hidden tags on hover', () => {
      render(<TagList tags={manyTags} maxVisible={3} onTagClick={vi.fn()} selectedTags={[]} />)
      
      const moreIndicator = screen.getByText('+4 more')
      fireEvent.mouseEnter(moreIndicator)
      
      // Should show additional tags in tooltip - they appear in the document when tooltip is visible
      expect(screen.getAllByText('#frontend')).toHaveLength(1)
      expect(screen.getAllByText('#backend')).toHaveLength(1)
      expect(screen.getAllByText('#nodejs')).toHaveLength(1)
      expect(screen.getAllByText('#typescript')).toHaveLength(1)
    })

    it('should respect default maxVisible value', () => {
      render(<TagList tags={manyTags} onTagClick={vi.fn()} selectedTags={[]} />)
      
      // Default maxVisible should be 5, so first 5 tags should be visible
      expect(screen.getByText('#javascript')).toBeInTheDocument()
      expect(screen.getByText('#react')).toBeInTheDocument()
      expect(screen.getByText('#testing')).toBeInTheDocument()
      expect(screen.getByText('#frontend')).toBeInTheDocument()
      expect(screen.getByText('#backend')).toBeInTheDocument()
      
      // Should show "+X more" for remaining tags
      expect(screen.getByText('+2 more')).toBeInTheDocument()
      
      // Remaining tags should not be visible
      expect(screen.queryByText('#nodejs')).not.toBeInTheDocument()
      expect(screen.queryByText('#typescript')).not.toBeInTheDocument()
    })
  })

  describe('Tag Selection and Highlighting', () => {
    it('should highlight selected tags', () => {
      render(<TagList {...defaultProps} selectedTags={['javascript', 'react']} />)
      
      const jsTag = screen.getByText('#javascript').closest('button')
      const reactTag = screen.getByText('#react').closest('button')
      const testingTag = screen.getByText('#testing').closest('button')
      
      expect(jsTag).toHaveClass('bg-primary/30', 'text-primary', 'font-semibold', 'border-primary/50')
      expect(reactTag).toHaveClass('bg-primary/30', 'text-primary', 'font-semibold', 'border-primary/50')
      expect(testingTag).toHaveClass('bg-primary/10', 'hover:bg-primary/20', 'text-primary')
    })

    it('should handle empty selectedTags array', () => {
      render(<TagList {...defaultProps} selectedTags={[]} />)
      
      const jsTag = screen.getByText('#javascript').closest('button')
      expect(jsTag).toHaveClass('bg-primary/10', 'hover:bg-primary/20', 'text-primary')
    })
  })

  describe('Click Interactions', () => {
    it('should call onTagClick when tag is clicked', () => {
      render(<TagList {...defaultProps} />)
      
      fireEvent.click(screen.getByText('#javascript'))
      expect(defaultProps.onTagClick).toHaveBeenCalledWith('javascript')
    })

    it('should call onTagClick with correct tag name', () => {
      render(<TagList {...defaultProps} />)
      
      fireEvent.click(screen.getByText('#react'))
      expect(defaultProps.onTagClick).toHaveBeenCalledWith('react')
    })

    it('should not fail when onTagClick is not provided', () => {
      render(<TagList tags={['javascript']} selectedTags={[]} />)
      
      expect(() => {
        fireEvent.click(screen.getByText('#javascript'))
      }).not.toThrow()
    })
  })

  describe('Custom Styling', () => {
    it('should apply custom className when provided', () => {
      const { container } = render(<TagList {...defaultProps} className="custom-class" />)
      
      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('should merge custom className with default classes', () => {
      const { container } = render(<TagList {...defaultProps} className="custom-class" />)
      
      expect(container.firstChild).toHaveClass('flex', 'flex-wrap', 'items-center', 'gap-2', 'custom-class')
    })
  })

  describe('Tag Formatting', () => {
    it('should prefix tags with # symbol', () => {
      render(<TagList tags={['test']} onTagClick={vi.fn()} selectedTags={[]} />)
      
      expect(screen.getByText('#test')).toBeInTheDocument()
      expect(screen.queryByText('test')).not.toBeInTheDocument()
    })

    it('should handle tags with special characters', () => {
      render(<TagList tags={['react-native', 'vue.js', 'C++']} onTagClick={vi.fn()} selectedTags={[]} />)
      
      expect(screen.getByText('#react-native')).toBeInTheDocument()
      expect(screen.getByText('#vue.js')).toBeInTheDocument()
      expect(screen.getByText('#C++')).toBeInTheDocument()
    })

    it('should handle Chinese tags', () => {
      render(<TagList tags={['前端', '后端', '全栈']} onTagClick={vi.fn()} selectedTags={[]} />)
      
      expect(screen.getByText('#前端')).toBeInTheDocument()
      expect(screen.getByText('#后端')).toBeInTheDocument()
      expect(screen.getByText('#全栈')).toBeInTheDocument()
    })

    it('should handle long tag names', () => {
      const longTag = 'very-long-tag-name-that-might-overflow'
      render(<TagList tags={[longTag]} onTagClick={vi.fn()} selectedTags={[]} />)
      
      expect(screen.getByText(`#${longTag}`)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should render tags as buttons for keyboard accessibility', () => {
      render(<TagList {...defaultProps} />)
      
      const buttons = screen.getAllByRole('button').filter(btn => 
        btn.textContent?.startsWith('#') && btn.textContent !== '更多'
      )
      expect(buttons).toHaveLength(3)
    })

    it('should handle tag clicks through TagBadge component', () => {
      render(<TagList {...defaultProps} />)
      
      const jsTag = screen.getByText('#javascript')
      fireEvent.click(jsTag)
      
      expect(defaultProps.onTagClick).toHaveBeenCalledWith('javascript')
    })

    it('should have proper button semantics', () => {
      render(<TagList {...defaultProps} />)
      
      const tagButtons = screen.getAllByRole('button').filter(btn => 
        btn.textContent?.startsWith('#')
      )
      
      // TagBadge components should be rendered as buttons
      expect(tagButtons.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle single tag', () => {
      render(<TagList tags={['solo']} onTagClick={vi.fn()} selectedTags={[]} />)
      
      expect(screen.getByText('#solo')).toBeInTheDocument()
      expect(screen.queryByText('更多')).not.toBeInTheDocument()
    })

    it('should handle maxVisible of 0', () => {
      render(<TagList tags={['test']} maxVisible={0} onTagClick={vi.fn()} selectedTags={[]} />)
      
      expect(screen.getByText('+1 more')).toBeInTheDocument()
      expect(screen.queryByText('#test')).not.toBeInTheDocument()
    })

    it('should handle maxVisible larger than tags length', () => {
      render(<TagList tags={['test']} maxVisible={10} onTagClick={vi.fn()} selectedTags={[]} />)
      
      expect(screen.getByText('#test')).toBeInTheDocument()
      expect(screen.queryByText(/more/)).not.toBeInTheDocument()
    })
  })
})