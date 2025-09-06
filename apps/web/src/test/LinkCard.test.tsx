import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LinkCard from '../components/LinkCard'

// Mock the API module
vi.mock('../utils/api', () => ({
  default: {
    getDomainStats: vi.fn(),
  }
}))

describe('LinkCard', () => {
  const mockLink = {
    id: 1,
    url: 'https://example.com/article',
    title: 'Test Article Title',
    description: 'This is a test description for the article.',
    category: '技术',
    tags: ['javascript', 'react', 'testing', 'frontend'],
    domain: 'example.com',
    publishedAt: 1705314600,
    createdAt: 1705314600,
    readingTime: 5
  }

  const defaultProps = {
    link: mockLink,
    onTitleClick: vi.fn(),
    onTagClick: vi.fn(),
    selectedTags: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-20T10:30:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Basic Rendering', () => {
    it('should render link title correctly', () => {
      render(<LinkCard {...defaultProps} />)
      
      expect(screen.getByText('Test Article Title')).toBeInTheDocument()
      expect(screen.getByText('Test Article Title')).toHaveAttribute('title', 'Test Article Title')
    })

    it('should render link description', () => {
      render(<LinkCard {...defaultProps} />)
      
      expect(screen.getByText('This is a test description for the article.')).toBeInTheDocument()
    })

    it('should render domain', () => {
      render(<LinkCard {...defaultProps} />)
      
      expect(screen.getByText('example.com')).toBeInTheDocument()
    })

    it('should render category', () => {
      render(<LinkCard {...defaultProps} />)
      
      expect(screen.getByText('技术')).toBeInTheDocument()
    })

    it('should render all 4 tags when under limit', () => {
      render(<LinkCard {...defaultProps} />)
      
      expect(screen.getByText('#javascript')).toBeInTheDocument()
      expect(screen.getByText('#react')).toBeInTheDocument()
      expect(screen.getByText('#testing')).toBeInTheDocument()
      expect(screen.getByText('#frontend')).toBeInTheDocument()
      expect(screen.queryByText('+1 more')).not.toBeInTheDocument()
    })

    it('should not show +more when tags are 5 or fewer', () => {
      const linkWith2Tags = { ...mockLink, tags: ['javascript', 'react'] }
      render(<LinkCard {...defaultProps} link={linkWith2Tags} />)
      
      expect(screen.getByText('#javascript')).toBeInTheDocument()
      expect(screen.getByText('#react')).toBeInTheDocument()
      expect(screen.queryByText('+1 more')).not.toBeInTheDocument()
    })

    it('should show +more when tags exceed 5', () => {
      const linkWithManyTags = { ...mockLink, tags: ['javascript', 'react', 'testing', 'frontend', 'backend', 'nodejs'] }
      render(<LinkCard {...defaultProps} link={linkWithManyTags} />)
      
      // Should show first 5 tags
      expect(screen.getByText('#javascript')).toBeInTheDocument()
      expect(screen.getByText('#react')).toBeInTheDocument()
      expect(screen.getByText('#testing')).toBeInTheDocument()
      expect(screen.getByText('#frontend')).toBeInTheDocument()
      expect(screen.getByText('#backend')).toBeInTheDocument()
      
      // Should show +more for remaining tags
      expect(screen.getByText('+1 more')).toBeInTheDocument()
      
      // Should not show the 6th tag initially
      expect(screen.queryByText('#nodejs')).not.toBeInTheDocument()
    })

    it('should handle missing description', () => {
      const linkWithoutDesc = { ...mockLink, description: '' }
      render(<LinkCard {...defaultProps} link={linkWithoutDesc} />)
      
      expect(screen.queryByText('This is a test description')).not.toBeInTheDocument()
    })
  })

  describe('Date Formatting', () => {
    it('should format recent dates correctly', () => {
      render(<LinkCard {...defaultProps} />)
      
      // 5天前 from the mocked current time (Chinese format)
      expect(screen.getByText('5天前')).toBeInTheDocument()
    })

    it('should show "昨天" for yesterday', () => {
      const yesterdayLink = {
        ...mockLink,
        publishedAt: 1705660200 // Yesterday
      }
      render(<LinkCard {...defaultProps} link={yesterdayLink} />)
      
      expect(screen.getByText('昨天')).toBeInTheDocument()
    })

    it('should show weeks for recent weeks', () => {
      const twoWeeksAgoLink = {
        ...mockLink,
        publishedAt: 1704537000 // 2 weeks ago
      }
      render(<LinkCard {...defaultProps} link={twoWeeksAgoLink} />)
      
      expect(screen.getByText('2周前')).toBeInTheDocument()
    })

    it('should show months for older dates', () => {
      const oldLink = {
        ...mockLink,
        publishedAt: 1700044200 // Several months ago
      }
      render(<LinkCard {...defaultProps} link={oldLink} />)
      
      // Should show months - accept any number of months (Chinese format)
      expect(screen.getByText(/\d+个月前/)).toBeInTheDocument()
    })
  })

  describe('Click Interactions', () => {
    it('should call onTitleClick when title is clicked', () => {
      render(<LinkCard {...defaultProps} />)
      
      fireEvent.click(screen.getByText('Test Article Title'))
      expect(defaultProps.onTitleClick).toHaveBeenCalled()
    })

    it('should call onTagClick when tag is clicked', () => {
      render(<LinkCard {...defaultProps} />)
      
      fireEvent.click(screen.getByText('#javascript'))
      expect(defaultProps.onTagClick).toHaveBeenCalledWith('javascript')
    })

    it('should handle domain click (currently logs to console)', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      render(<LinkCard {...defaultProps} />)
      
      fireEvent.click(screen.getByText('example.com'))
      expect(consoleSpy).toHaveBeenCalledWith('Filter by domain:', 'example.com')
      
      consoleSpy.mockRestore()
    })

    it('should handle category click (currently logs to console)', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      render(<LinkCard {...defaultProps} />)
      
      fireEvent.click(screen.getByText('技术'))
      expect(consoleSpy).toHaveBeenCalledWith('Filter by category:', '技术')
      
      consoleSpy.mockRestore()
    })

    it('should not call onTitleClick when onTitleClick is not provided', () => {
      render(<LinkCard link={mockLink} />)
      
      // Should not throw error when clicked
      fireEvent.click(screen.getByText('Test Article Title'))
    })

    it('should not call onTagClick when onTagClick is not provided', () => {
      render(<LinkCard link={mockLink} />)
      
      // Should not throw error when clicked
      fireEvent.click(screen.getByText('#javascript'))
    })
  })

  describe('Tag Highlighting', () => {
    it('should highlight selected tags', () => {
      render(<LinkCard {...defaultProps} selectedTags={['javascript', 'react']} />)
      
      const jsTag = screen.getByText('#javascript').closest('button')
      const reactTag = screen.getByText('#react').closest('button')
      const testingTag = screen.getByText('#testing').closest('button')
      
      expect(jsTag).toHaveClass('bg-primary/30', 'text-primary', 'font-semibold', 'border-primary/50')
      expect(reactTag).toHaveClass('bg-primary/30', 'text-primary', 'font-semibold', 'border-primary/50')
      expect(testingTag).toHaveClass('bg-primary/10', 'hover:bg-primary/20', 'text-primary')
    })

    it('should handle empty selectedTags array', () => {
      render(<LinkCard {...defaultProps} selectedTags={[]} />)
      
      const jsTag = screen.getByText('#javascript').closest('button')
      expect(jsTag).toHaveClass('bg-primary/10', 'hover:bg-primary/20', 'text-primary')
    })
  })

  describe('Styling and Layout', () => {
    it('should have correct CSS classes for title', () => {
      render(<LinkCard {...defaultProps} />)
      
      const title = screen.getByText('Test Article Title')
      expect(title).toHaveClass('text-lg', 'font-semibold', 'line-clamp-2', 'cursor-pointer', 'hover:underline')
      expect(title).toHaveStyle({ color: '#06161a' })
    })

    it('should have correct CSS classes for domain', () => {
      render(<LinkCard {...defaultProps} />)
      
      const domain = screen.getByText('example.com')
      expect(domain).toHaveStyle({ 
        color: '#2c5766',
        textDecoration: 'underline',
        textDecorationStyle: 'dashed'
      })
    })

    it('should have proper article structure', () => {
      render(<LinkCard {...defaultProps} />)
      
      const article = screen.getByRole('article')
      expect(article).toHaveClass('bg-transparent')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<LinkCard {...defaultProps} />)
      
      expect(screen.getByRole('article')).toBeInTheDocument()
      
      // Title should be clickable
      const title = screen.getByText('Test Article Title')
      expect(title).toHaveAttribute('title', 'Test Article Title')
    })

    it('should have cursor help for date element', () => {
      render(<LinkCard {...defaultProps} />)
      
      const dateElement = screen.getByText('5天前')
      expect(dateElement).toHaveClass('cursor-help')
    })

    it('should have proper button elements for interactive parts', () => {
      render(<LinkCard {...defaultProps} />)
      
      // Domain, category, and tags should be buttons
      expect(screen.getByText('example.com').closest('button')).toBeInTheDocument()
      expect(screen.getByText('技术').closest('button')).toBeInTheDocument()
      expect(screen.getByText('#javascript').closest('button')).toBeInTheDocument()
    })
  })

  describe('Reading Time Display', () => {
    it('should display reading time when provided', () => {
      render(<LinkCard {...defaultProps} />)
      
      expect(screen.getByText('5分钟')).toBeInTheDocument()
    })

    it('should format reading time under 1 hour correctly', () => {
      const link30Min = { ...mockLink, readingTime: 30 }
      render(<LinkCard {...defaultProps} link={link30Min} />)
      
      expect(screen.getByText('30分钟')).toBeInTheDocument()
    })

    it('should format reading time over 1 hour correctly', () => {
      const link90Min = { ...mockLink, readingTime: 90 }
      render(<LinkCard {...defaultProps} link={link90Min} />)
      
      expect(screen.getByText('1小时30分钟')).toBeInTheDocument()
    })

    it('should format exact hour reading time correctly', () => {
      const link2Hours = { ...mockLink, readingTime: 120 }
      render(<LinkCard {...defaultProps} link={link2Hours} />)
      
      expect(screen.getByText('2小时')).toBeInTheDocument()
    })

    it('should not display reading time when not provided', () => {
      const linkWithoutReadingTime = { ...mockLink, readingTime: undefined }
      render(<LinkCard {...defaultProps} link={linkWithoutReadingTime} />)
      
      expect(screen.queryByText(/分钟/)).not.toBeInTheDocument()
      expect(screen.queryByText(/小时/)).not.toBeInTheDocument()
    })

    it('should not display reading time when 0', () => {
      const linkWithZeroReadingTime = { ...mockLink, readingTime: 0 }
      render(<LinkCard {...defaultProps} link={linkWithZeroReadingTime} />)
      
      expect(screen.queryByText('0分钟')).not.toBeInTheDocument()
    })

    it('should show reading time tooltip on hover', async () => {
      render(<LinkCard {...defaultProps} />)
      
      const readingTimeElement = screen.getByText('5分钟')
      fireEvent.mouseEnter(readingTimeElement)
      
      expect(screen.getByText('预估阅读时间:5分钟')).toBeInTheDocument()
      
      fireEvent.mouseLeave(readingTimeElement)
      expect(screen.queryByText('预估阅读时间:5分钟')).not.toBeInTheDocument()
    })

    it('should have book icon for reading time', () => {
      render(<LinkCard {...defaultProps} />)
      
      // Check that the reading time section contains a book icon
      const readingTimeElement = screen.getByText('5分钟').closest('div')
      expect(readingTimeElement).toContainHTML('stroke="currentColor"')
      expect(readingTimeElement).toContainHTML('viewBox="0 0 24 24"')
    })
  })
})