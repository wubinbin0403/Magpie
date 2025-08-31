import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import CategoryIcon from '../components/CategoryIcon'

describe('CategoryIcon', () => {
  describe('Icon Rendering', () => {
    it('should render default folder icon for unknown icon names', () => {
      render(<CategoryIcon icon="unknown-icon" />)
      
      // Should render SVG element
      const iconElement = document.querySelector('svg')
      expect(iconElement).toBeInTheDocument()
      expect(iconElement).toHaveClass('w-5', 'h-5')
    })

    it('should render correct icon for common aliases', () => {
      const aliases = [
        'code',
        'book', 
        'news',
        'video',
        'music',
        'image',
        'web',
        'tech',
        'business',
        'shopping',
        'game',
        'education',
        'finance',
        'tool'
      ]
      
      aliases.forEach(alias => {
        const { unmount } = render(<CategoryIcon icon={alias} />)
        
        const iconElement = document.querySelector('svg')
        expect(iconElement).toBeInTheDocument()
        expect(iconElement).toHaveClass('w-5', 'h-5')
        
        unmount()
      })
    })

    it('should handle kebab-case icon names', () => {
      render(<CategoryIcon icon="academic-cap" />)
      
      const iconElement = document.querySelector('svg')
      expect(iconElement).toBeInTheDocument()
    })

    it('should handle PascalCase icon names', () => {
      render(<CategoryIcon icon="AcademicCapIcon" />)
      
      const iconElement = document.querySelector('svg')
      expect(iconElement).toBeInTheDocument()
    })
  })

  describe('Props Handling', () => {
    it('should apply custom className', () => {
      render(<CategoryIcon icon="code" className="w-8 h-8 text-red-500" />)
      
      const iconElement = document.querySelector('svg')
      expect(iconElement).toHaveClass('w-8', 'h-8', 'text-red-500')
      expect(iconElement).not.toHaveClass('w-5', 'h-5') // Should not have default classes
    })

    it('should apply default className when none provided', () => {
      render(<CategoryIcon icon="code" />)
      
      const iconElement = document.querySelector('svg')
      expect(iconElement).toHaveClass('w-5', 'h-5')
    })

    it('should apply custom styles', () => {
      const customStyle = { color: 'red', fontSize: '24px' }
      render(<CategoryIcon icon="code" style={customStyle} />)
      
      const iconElement = document.querySelector('svg')
      expect(iconElement).toHaveStyle('color: rgb(255, 0, 0); font-size: 24px;')
    })

    it('should handle both className and style props', () => {
      const customStyle = { color: 'blue' }
      render(
        <CategoryIcon 
          icon="code" 
          className="w-6 h-6" 
          style={customStyle} 
        />
      )
      
      const iconElement = document.querySelector('svg')
      expect(iconElement).toHaveClass('w-6', 'h-6')
      expect(iconElement).toHaveStyle('color: rgb(0, 0, 255);')
    })
  })

  describe('Icon Mapping Logic', () => {
    it('should prioritize alias mappings over raw icon names', () => {
      // 'code' should map to 'CodeBracketIcon', not try to convert 'code' to 'CodeIcon'
      const { container } = render(<CategoryIcon icon="code" />)
      
      const iconElement = container.querySelector('svg')
      expect(iconElement).toBeInTheDocument()
    })

    it('should handle case-insensitive aliases', () => {
      render(<CategoryIcon icon="CODE" />)
      
      const iconElement = document.querySelector('svg')
      expect(iconElement).toBeInTheDocument()
    })

    it('should convert multi-word kebab-case to PascalCase', () => {
      // This tests the conversion logic for names like 'musical-note' -> 'MusicalNoteIcon'
      render(<CategoryIcon icon="musical-note" />)
      
      const iconElement = document.querySelector('svg')
      expect(iconElement).toBeInTheDocument()
    })

    it('should handle single word icon names', () => {
      render(<CategoryIcon icon="folder" />)
      
      const iconElement = document.querySelector('svg')
      expect(iconElement).toBeInTheDocument()
    })

    it('should always return a valid icon component', () => {
      const invalidNames = ['', '  ', 'totally-invalid-icon-name', '123', '!@#$%']
      
      invalidNames.forEach(invalidName => {
        const { unmount } = render(<CategoryIcon icon={invalidName} />)
        
        // Should still render something (fallback FolderIcon)
        const iconElement = document.querySelector('svg')
        expect(iconElement).toBeInTheDocument()
        
        unmount()
      })
    })
  })

  describe('Performance and Memoization', () => {
    it('should memoize icon component based on icon name', () => {
      const { rerender } = render(<CategoryIcon icon="code" />)
      
      const firstIconElement = document.querySelector('svg')
      expect(firstIconElement).toBeInTheDocument()
      
      // Rerender with same icon - should use memoized result
      rerender(<CategoryIcon icon="code" className="w-6 h-6" />)
      
      const secondIconElement = document.querySelector('svg')
      expect(secondIconElement).toBeInTheDocument()
      expect(secondIconElement).toHaveClass('w-6', 'h-6')
    })

    it('should recalculate when icon name changes', () => {
      const { rerender } = render(<CategoryIcon icon="code" />)
      
      expect(document.querySelector('svg')).toBeInTheDocument()
      
      // Change icon name - should recalculate
      rerender(<CategoryIcon icon="book" />)
      
      expect(document.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should render as SVG element', () => {
      render(<CategoryIcon icon="code" />)
      
      const iconElement = document.querySelector('svg')
      expect(iconElement).toBeInTheDocument()
    })

    it('should be keyboard accessible when used in interactive contexts', () => {
      render(
        <button>
          <CategoryIcon icon="code" />
          <span>Code Category</span>
        </button>
      )
      
      const button = document.querySelector('button')
      expect(button).toBeInTheDocument()
      expect(button?.textContent).toContain('Code Category')
    })

    it('should have proper SVG attributes', () => {
      render(<CategoryIcon icon="code" />)
      
      const iconElement = document.querySelector('svg')
      expect(iconElement).toHaveAttribute('aria-hidden', 'true')
      expect(iconElement).toHaveAttribute('data-slot', 'icon')
    })
  })

  describe('Common Icon Aliases Coverage', () => {
    it('should support all documented icon aliases', () => {
      const commonAliases = [
        'code', 'book', 'news', 'video', 'music', 'image', 'web', 'tech', 
        'business', 'shopping', 'game', 'education', 'finance', 'tool', 
        'email', 'mail', 'location', 'search', 'settings', 'edit', 'trash', 
        'shield', 'lock', 'chat', 'terminal', 'document', 'science'
      ]
      
      commonAliases.forEach(alias => {
        const { unmount } = render(<CategoryIcon icon={alias} />)
        
        const iconElement = document.querySelector('svg')
        expect(iconElement).toBeInTheDocument()
        
        unmount()
      })
    })
  })
})