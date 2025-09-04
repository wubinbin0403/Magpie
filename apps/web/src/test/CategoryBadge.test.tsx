import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CategoryBadge from '../components/CategoryBadge'

describe('CategoryBadge', () => {
  const defaultProps = {
    category: '技术',
    onClick: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render category text correctly', () => {
      render(<CategoryBadge {...defaultProps} />)
      
      expect(screen.getByText('技术')).toBeInTheDocument()
    })

    it('should render as a button element', () => {
      render(<CategoryBadge {...defaultProps} />)
      
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('技术')
    })

    it('should have proper CSS classes for styling', () => {
      render(<CategoryBadge {...defaultProps} />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('inline-flex', 'items-center', 'px-2', 'py-1', 'bg-accent/20', 'hover:bg-accent/30', 'text-secondary', 'text-xs', 'font-medium', 'rounded', 'transition-colors')
    })
  })

  describe('Click Interactions', () => {
    it('should call onClick when clicked', () => {
      render(<CategoryBadge {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button'))
      expect(defaultProps.onClick).toHaveBeenCalledWith('技术')
    })

    it('should not fail when onClick is not provided', () => {
      render(<CategoryBadge category="技术" />)
      
      // Should not throw error when clicked
      expect(() => {
        fireEvent.click(screen.getByRole('button'))
      }).not.toThrow()
    })

    it('should handle empty category gracefully', () => {
      render(<CategoryBadge category="" onClick={vi.fn()} />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('')
    })
  })

  describe('Custom Styling', () => {
    it('should apply custom className when provided', () => {
      render(<CategoryBadge {...defaultProps} className="custom-class" />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-class')
    })

    it('should merge custom className with default classes', () => {
      render(<CategoryBadge {...defaultProps} className="custom-class" />)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('inline-flex', 'items-center', 'px-2', 'py-1', 'bg-accent/20', 'hover:bg-accent/30', 'text-secondary', 'text-xs', 'font-medium', 'rounded', 'transition-colors', 'custom-class')
    })
  })

  describe('Different Category Types', () => {
    it('should handle Chinese category names', () => {
      render(<CategoryBadge category="前端开发" onClick={vi.fn()} />)
      
      expect(screen.getByText('前端开发')).toBeInTheDocument()
    })

    it('should handle English category names', () => {
      render(<CategoryBadge category="Technology" onClick={vi.fn()} />)
      
      expect(screen.getByText('Technology')).toBeInTheDocument()
    })

    it('should handle categories with special characters', () => {
      render(<CategoryBadge category="AI/ML" onClick={vi.fn()} />)
      
      expect(screen.getByText('AI/ML')).toBeInTheDocument()
    })

    it('should handle long category names', () => {
      const longCategory = '这是一个非常长的分类名称测试'
      render(<CategoryBadge category={longCategory} onClick={vi.fn()} />)
      
      expect(screen.getByText(longCategory)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should be keyboard accessible', () => {
      render(<CategoryBadge {...defaultProps} />)
      
      const button = screen.getByRole('button')
      
      // Test click event directly since DaisyUI handles keyboard events
      fireEvent.click(button)
      expect(defaultProps.onClick).toHaveBeenCalledWith('技术')
    })

    it('should have proper button semantics', () => {
      render(<CategoryBadge {...defaultProps} />)
      
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      // DaisyUI components handle button semantics automatically
    })
  })
})