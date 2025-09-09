import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import NavBar from '../components/NavBar'

// Mock the router
const NavBarWithRouter = ({ 
  onSearch, 
  onLogoClick,
  initialSearchQuery,
  categories,
  selectedCategory,
  onCategoryFilter
}: { 
  onSearch: (query: string) => void
  onLogoClick?: () => void
  initialSearchQuery?: string
  categories?: Array<{id: number, name: string, slug: string, icon: string, displayOrder: number, count?: number}>
  selectedCategory?: string | null
  onCategoryFilter?: (category: string | null) => void
}) => (
  <BrowserRouter>
    <NavBar 
      onSearch={onSearch} 
      onLogoClick={onLogoClick} 
      initialSearchQuery={initialSearchQuery}
      categories={categories}
      selectedCategory={selectedCategory}
      onCategoryFilter={onCategoryFilter}
    />
  </BrowserRouter>
)

describe('NavBar', () => {
  const mockOnSearch = vi.fn()
  const mockOnLogoClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any event listeners
    document.removeEventListener('keydown', vi.fn())
  })

  describe('Basic Rendering', () => {
    it('should render navbar with correct styling', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const navbar = document.querySelector('.navbar')
      expect(navbar).toBeInTheDocument()
      expect(navbar).toHaveClass('navbar', 'text-white', 'shadow-lg', 'fixed', 'top-0')
      expect(navbar).toHaveStyle({ backgroundColor: '#127176' })
    })

    it('should render logo with correct text and image', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      // Should have two "Magpie" text elements (mobile and desktop)
      const magpieTexts = screen.getAllByText('Magpie')
      expect(magpieTexts).toHaveLength(2)
      
      // Should have two logo images (mobile and desktop)
      const magpieImages = screen.getAllByAltText('Magpie')
      expect(magpieImages).toHaveLength(2)
      magpieImages.forEach(img => {
        expect(img).toHaveAttribute('src', '/magpie-icon.png')
      })
    })

    it('should render search input with correct placeholder', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      // Should have two search inputs (desktop visible, mobile hidden initially)
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...')
      expect(searchInputs).toHaveLength(2)
      
      // Desktop search input should have the correct classes
      const desktopSearchInput = searchInputs.find(input => 
        input.closest('.hidden.lg\\:flex')
      )
      expect(desktopSearchInput).toHaveClass('input', 'input-sm')
    })

    it('should render archive button', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const archiveButton = screen.getByTitle('Archive')
      expect(archiveButton).toBeInTheDocument()
      expect(archiveButton).toHaveAttribute('href', '/search')
    })

    it('should render dropdown menu', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      expect(screen.getByText('订阅RSS (XML)')).toBeInTheDocument()
      expect(screen.getByText('订阅Feed (JSON)')).toBeInTheDocument()
    })
  })

  describe('Search Functionality', () => {
    it('should call onSearch when form is submitted', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      // Use the desktop search input (first one should be visible)
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...')
      const desktopSearchInput = searchInputs[0]
      
      await user.type(desktopSearchInput, 'test search query')
      await user.type(desktopSearchInput, '{enter}')
      
      expect(mockOnSearch).toHaveBeenCalledWith('test search query')
    })

    it('should update search input value when typing', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...')
      const desktopSearchInput = searchInputs[0] as HTMLInputElement
      
      await user.type(desktopSearchInput, 'test query')
      
      expect(desktopSearchInput.value).toBe('test query')
    })

    it('should prevent default form submission behavior', async () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...')
      const form = searchInputs[0].closest('form')!
      const mockPreventDefault = vi.fn()
      
      const event = new Event('submit', { bubbles: true, cancelable: true })
      event.preventDefault = mockPreventDefault
      
      fireEvent(form, event)
      
      expect(mockPreventDefault).toHaveBeenCalled()
    })

    it('should show keyboard shortcut hint when not focused', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      expect(screen.getByText('⌘K')).toBeInTheDocument()
    })

    it('should show enter hint when focused', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...')
      const desktopSearchInput = searchInputs[0]
      await user.click(desktopSearchInput)
      
      expect(screen.getByText('↵')).toBeInTheDocument()
      expect(screen.queryByText('⌘K')).not.toBeInTheDocument()
    })
  })

  describe('Search Input Focus States', () => {
    it('should expand search input width on focus', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...')
      const desktopSearchInput = searchInputs[0]
      
      await user.click(desktopSearchInput)
      
      expect(desktopSearchInput).toHaveClass('w-64')
    })

    it('should return to normal width on blur', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...')
      const desktopSearchInput = searchInputs[0]
      
      await user.click(desktopSearchInput)
      expect(desktopSearchInput).toHaveClass('w-64')
      
      await user.click(document.body)
      
      await waitFor(() => {
        expect(desktopSearchInput).not.toHaveClass('w-64')
      })
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should focus search input when Cmd+K is pressed', async () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...')
      const desktopSearchInput = searchInputs[0]
      
      fireEvent.keyDown(document, { key: 'k', metaKey: true })
      
      expect(desktopSearchInput).toHaveFocus()
    })

    it('should focus search input when Ctrl+K is pressed', async () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...')
      const desktopSearchInput = searchInputs[0]
      
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
      
      expect(desktopSearchInput).toHaveFocus()
    })

    it('should blur search input when Cmd+K is pressed and input is already focused', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...')
      const desktopSearchInput = searchInputs[0]
      
      // Focus the input first
      await user.click(desktopSearchInput)
      expect(desktopSearchInput).toHaveFocus()
      
      // Press Cmd+K to blur
      fireEvent.keyDown(document, { key: 'k', metaKey: true })
      
      expect(desktopSearchInput).not.toHaveFocus()
    })

    it('should blur search input when Escape is pressed while focused', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...')
      const desktopSearchInput = searchInputs[0]
      
      await user.click(desktopSearchInput)
      expect(desktopSearchInput).toHaveFocus()
      
      fireEvent.keyDown(document, { key: 'Escape' })
      
      expect(desktopSearchInput).not.toHaveFocus()
    })

    it('should prevent default behavior for keyboard shortcuts', async () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const mockPreventDefault = vi.fn()
      const event = new KeyboardEvent('keydown', { 
        key: 'k', 
        metaKey: true, 
        bubbles: true,
        cancelable: true 
      })
      event.preventDefault = mockPreventDefault
      
      fireEvent(document, event)
      
      expect(mockPreventDefault).toHaveBeenCalled()
    })

    it('should not interfere with other keyboard shortcuts', async () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...')
      const desktopSearchInput = searchInputs[0]
      
      // Test other key combinations that should not trigger focus
      fireEvent.keyDown(document, { key: 'j', metaKey: true })
      expect(desktopSearchInput).not.toHaveFocus()
      
      fireEvent.keyDown(document, { key: 'k' }) // Without meta/ctrl
      expect(desktopSearchInput).not.toHaveFocus()
    })
  })

  describe('Mobile Navigation', () => {
    it('should render mobile menu button on small screens', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const mobileMenuButton = document.querySelector('.lg\\:hidden .dropdown .btn')
      expect(mobileMenuButton).toBeInTheDocument()
      expect(mobileMenuButton).toHaveClass('btn', 'btn-ghost')
    })

    it('should render mobile dropdown menu items', () => {
      const mockCategories = [
        { id: 1, name: 'Tech', slug: 'tech', icon: 'desktop-computer', displayOrder: 1, count: 5 },
        { id: 2, name: 'Design', slug: 'design', icon: 'color-swatch', displayOrder: 2, count: 3 }
      ]
      
      render(
        <NavBarWithRouter 
          onSearch={mockOnSearch} 
          categories={mockCategories}
          selectedCategory={null}
          onCategoryFilter={vi.fn()}
        />
      )
      
      // Mobile dropdown should contain category buttons including "All"
      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('Tech')).toBeInTheDocument()
      expect(screen.getByText('Design')).toBeInTheDocument()
    })

    it('should render mobile search button', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const mobileSearchButton = screen.getByTitle('搜索')
      expect(mobileSearchButton).toBeInTheDocument()
      expect(mobileSearchButton).toHaveClass('btn', 'btn-ghost', 'btn-sm', 'hover:bg-white/10')
    })

    it('should show mobile search overlay when search button is clicked', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const mobileSearchButton = screen.getByTitle('搜索')
      await user.click(mobileSearchButton)
      
      // Should show the mobile search overlay
      const mobileSearchOverlay = document.querySelector('.lg\\:hidden.fixed.inset-0')
      expect(mobileSearchOverlay).toBeInTheDocument()
    })

    it('should hide mobile search overlay when clicked', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const mobileSearchButton = screen.getByTitle('搜索')
      await user.click(mobileSearchButton)
      
      const mobileSearchOverlay = document.querySelector('.lg\\:hidden.fixed.inset-0')!
      await user.click(mobileSearchOverlay)
      
      await waitFor(() => {
        const overlay = document.querySelector('.lg\\:hidden.fixed.inset-0')
        expect(overlay).not.toBeInTheDocument()
      })
    })

    it('should submit search from mobile search input', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      // Open mobile search
      const mobileSearchButton = screen.getByTitle('搜索')
      await user.click(mobileSearchButton)
      
      // Find mobile search input (it should be the second one)
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...')
      const mobileSearchInput = searchInputs[1] // Second input should be mobile
      
      await user.type(mobileSearchInput, 'mobile search query')
      await user.type(mobileSearchInput, '{enter}')
      
      expect(mockOnSearch).toHaveBeenCalledWith('mobile search query')
    })

    it('should close mobile search after submitting', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      // Open mobile search
      const mobileSearchButton = screen.getByTitle('搜索')
      await user.click(mobileSearchButton)
      
      // Submit search
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...')
      const mobileSearchInput = searchInputs[1]
      
      await user.type(mobileSearchInput, 'test{enter}')
      
      // Mobile search should be closed after submit
      await waitFor(() => {
        const overlay = document.querySelector('.lg\\:hidden.fixed.inset-0')
        expect(overlay).not.toBeInTheDocument()
      })
    })

    it('should close mobile search when Escape is pressed', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      // Open mobile search
      const mobileSearchButton = screen.getByTitle('搜索')
      await user.click(mobileSearchButton)
      
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...')
      const mobileSearchInput = searchInputs[1]
      
      await user.type(mobileSearchInput, '{Escape}')
      
      await waitFor(() => {
        const overlay = document.querySelector('.lg\\:hidden.fixed.inset-0')
        expect(overlay).not.toBeInTheDocument()
      })
    })
  })

  describe('Navigation Links', () => {
    it('should have correct logo link', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const logoLinks = screen.getAllByText('Magpie').map(text => text.closest('a')).filter(Boolean)
      expect(logoLinks.length).toBeGreaterThan(0)
      logoLinks.forEach(link => {
        expect(link).toHaveAttribute('href', '/')
      })
    })

    it('should have correct archive button link', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const archiveButton = screen.getByTitle('Archive')
      expect(archiveButton).toHaveAttribute('href', '/search')
    })

    it('should have hover effects on interactive elements', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const logoLinks = screen.getAllByText('Magpie').map(text => text.closest('a')).filter(Boolean)
      logoLinks.forEach(link => {
        expect(link).toHaveClass('hover:bg-white/10')
      })
      
      const archiveButton = screen.getByTitle('Archive')
      expect(archiveButton).toHaveClass('hover:bg-white/10')
    })
  })

  describe('Logo Animation', () => {
    it('should have 3D flip animation on logo hover', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const logoImages = screen.getAllByAltText('Magpie')
      logoImages.forEach(img => {
        expect(img).toHaveClass('group-hover:[transform:rotateY(180deg)]')
        expect(img).toHaveStyle({ transformStyle: 'preserve-3d' })
      })
    })
  })

  describe('Dropdown Menu', () => {
    it('should render dropdown menu items with correct styling', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const rssItem = screen.getByText('订阅RSS (XML)').closest('a')
      const jsonItem = screen.getByText('订阅Feed (JSON)').closest('a')
      
      expect(rssItem).toHaveClass('flex', 'items-center', 'gap-3', 'hover:bg-slate-100')
      expect(jsonItem).toHaveClass('flex', 'items-center', 'gap-3', 'hover:bg-slate-100')
    })

    it('should have proper dropdown positioning', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const dropdown = screen.getByText('订阅RSS (XML)').closest('.dropdown-content')
      expect(dropdown).toHaveClass('dropdown-content')
      
      const dropdownContainer = document.querySelector('.dropdown.dropdown-end')
      expect(dropdownContainer).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA roles and attributes', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      // Search inputs should be accessible
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...')
      searchInputs.forEach(input => {
        expect(input).toHaveAttribute('type', 'text')
      })
      
      // Mobile menu button should have tabIndex
      const mobileMenuButton = document.querySelector('.lg\\:hidden .dropdown [role="button"]')
      expect(mobileMenuButton).toHaveAttribute('tabIndex', '0')
    })

    it('should have proper form structure for screen readers', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...')
      const forms = searchInputs.map(input => input.closest('form')).filter(Boolean)
      expect(forms.length).toBeGreaterThan(0)
      forms.forEach(form => {
        expect(form).toBeInTheDocument()
      })
    })

    it('should have descriptive titles', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      expect(screen.getByTitle('Archive')).toBeInTheDocument()
    })
  })

  describe('Logo Click Functionality', () => {
    it('should render logo as Link when onLogoClick is not provided', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const logoLinks = screen.getAllByText('Magpie').map(text => text.closest('a')).filter(Boolean)
      expect(logoLinks.length).toBe(2) // Mobile and desktop
      logoLinks.forEach(link => {
        expect(link).toBeInTheDocument()
        expect(link).toHaveAttribute('href', '/')
      })
    })

    it('should render logo as button when onLogoClick is provided', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} onLogoClick={mockOnLogoClick} />)
      
      const logoButtons = screen.getAllByText('Magpie').map(text => text.closest('button')).filter(Boolean)
      expect(logoButtons.length).toBe(2) // Mobile and desktop
      logoButtons.forEach(button => {
        expect(button).toBeInTheDocument()
        expect(button).toHaveClass('btn', 'btn-ghost', 'hover:bg-white/10', 'group')
      })
    })

    it('should call onLogoClick when logo button is clicked', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} onLogoClick={mockOnLogoClick} />)
      
      const logoButtons = screen.getAllByText('Magpie').map(text => text.closest('button')).filter(Boolean)
      const firstLogoButton = logoButtons[0]!
      
      await user.click(firstLogoButton)
      
      expect(mockOnLogoClick).toHaveBeenCalledTimes(1)
    })

    it('should preserve logo styling when rendered as button', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} onLogoClick={mockOnLogoClick} />)
      
      const logoButtons = screen.getAllByText('Magpie').map(text => text.closest('button')).filter(Boolean)
      const logoImages = screen.getAllByAltText('Magpie')
      const logoTexts = screen.getAllByText('Magpie')
      
      logoButtons.forEach(button => {
        expect(button).toHaveClass('btn', 'btn-ghost', 'hover:bg-white/10', 'group')
      })
      
      logoImages.forEach(img => {
        expect(img).toHaveClass('group-hover:[transform:rotateY(180deg)]')
        expect(img).toHaveAttribute('src', '/magpie-icon.png')
      })
      
      // Check that at least one logo text has the desktop styling (larger text)
      const desktopLogoText = logoTexts.find(text => text.classList.contains('text-xl'))
      expect(desktopLogoText).toHaveClass('text-white', 'text-xl', 'font-bold')
    })
  })

  describe('Search Text Synchronization', () => {
    it('should initialize search input with initialSearchQuery', () => {
      const initialQuery = 'initial search'
      render(<NavBarWithRouter 
        onSearch={mockOnSearch} 
        initialSearchQuery={initialQuery} 
      />)
      
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...') as HTMLInputElement[]
      searchInputs.forEach(input => {
        expect(input.value).toBe(initialQuery)
      })
    })

    it('should update search input when initialSearchQuery changes', () => {
      const initialQuery = 'first query'
      const { rerender } = render(<NavBarWithRouter 
        onSearch={mockOnSearch} 
        initialSearchQuery={initialQuery} 
      />)
      
      let searchInputs = screen.getAllByPlaceholderText('搜索链接...') as HTMLInputElement[]
      searchInputs.forEach(input => {
        expect(input.value).toBe(initialQuery)
      })
      
      // Re-render with new initial query
      const newQuery = 'updated query'
      rerender(<NavBarWithRouter 
        onSearch={mockOnSearch} 
        initialSearchQuery={newQuery} 
      />)
      
      searchInputs = screen.getAllByPlaceholderText('搜索链接...') as HTMLInputElement[]
      searchInputs.forEach(input => {
        expect(input.value).toBe(newQuery)
      })
    })

    it('should handle empty initialSearchQuery', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} initialSearchQuery="" />)
      
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...') as HTMLInputElement[]
      searchInputs.forEach(input => {
        expect(input.value).toBe('')
      })
    })

    it('should handle undefined initialSearchQuery', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} initialSearchQuery={undefined} />)
      
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...') as HTMLInputElement[]
      searchInputs.forEach(input => {
        expect(input.value).toBe('')
      })
    })

    it('should allow user to override synchronized search text', async () => {
      const user = userEvent.setup()
      const initialQuery = 'synced query'
      render(<NavBarWithRouter 
        onSearch={mockOnSearch} 
        initialSearchQuery={initialQuery} 
      />)
      
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...') as HTMLInputElement[]
      const desktopSearchInput = searchInputs[0]
      expect(desktopSearchInput.value).toBe(initialQuery)
      
      // User clears and types new query
      await user.clear(desktopSearchInput)
      await user.type(desktopSearchInput, 'user typed query')
      
      expect(desktopSearchInput.value).toBe('user typed query')
    })

    it('should sync search text and still submit correctly', async () => {
      const user = userEvent.setup()
      const initialQuery = 'github'
      render(<NavBarWithRouter 
        onSearch={mockOnSearch} 
        initialSearchQuery={initialQuery} 
      />)
      
      const searchInputs = screen.getAllByPlaceholderText('搜索链接...') as HTMLInputElement[]
      const desktopSearchInput = searchInputs[0]
      expect(desktopSearchInput.value).toBe(initialQuery)
      
      // Submit without changing the value
      await user.type(desktopSearchInput, '{enter}')
      
      expect(mockOnSearch).toHaveBeenCalledWith(initialQuery)
    })
  })
})