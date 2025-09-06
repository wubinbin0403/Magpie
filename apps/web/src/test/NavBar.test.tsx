import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import NavBar from '../components/NavBar'

// Mock the router
const NavBarWithRouter = ({ 
  onSearch, 
  onLogoClick,
  initialSearchQuery 
}: { 
  onSearch: (query: string) => void
  onLogoClick?: () => void
  initialSearchQuery?: string
}) => (
  <BrowserRouter>
    <NavBar 
      onSearch={onSearch} 
      onLogoClick={onLogoClick} 
      initialSearchQuery={initialSearchQuery} 
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
      expect(navbar).toHaveClass('navbar', 'text-white', 'shadow-lg', 'fixed', 'top-0', 'z-50')
      expect(navbar).toHaveStyle({ backgroundColor: '#127176' })
    })

    it('should render logo with correct text and image', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      expect(screen.getByText('Magpie')).toBeInTheDocument()
      expect(screen.getByAltText('Magpie')).toBeInTheDocument()
      expect(screen.getByAltText('Magpie')).toHaveAttribute('src', '/magpie-icon.png')
    })

    it('should render search input with correct placeholder', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInput = screen.getByPlaceholderText('搜索链接...')
      expect(searchInput).toBeInTheDocument()
      expect(searchInput).toHaveClass('input', 'input-sm')
    })

    it('should render archive button', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const archiveButton = screen.getByTitle('Archive')
      expect(archiveButton).toBeInTheDocument()
      expect(archiveButton).toHaveAttribute('href', '/search')
    })

    it('should render dropdown menu', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      expect(screen.getByText('订阅RSS')).toBeInTheDocument()
      expect(screen.getByText('关于Magpie')).toBeInTheDocument()
      expect(screen.getByText('切换颜色')).toBeInTheDocument()
    })
  })

  describe('Search Functionality', () => {
    it('should call onSearch when form is submitted', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInput = screen.getByPlaceholderText('搜索链接...')
      
      await user.type(searchInput, 'test search query')
      await user.type(searchInput, '{enter}')
      
      expect(mockOnSearch).toHaveBeenCalledWith('test search query')
    })

    it('should update search input value when typing', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInput = screen.getByPlaceholderText('搜索链接...') as HTMLInputElement
      
      await user.type(searchInput, 'test query')
      
      expect(searchInput.value).toBe('test query')
    })

    it('should prevent default form submission behavior', async () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const form = screen.getByPlaceholderText('搜索链接...').closest('form')!
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
      
      const searchInput = screen.getByPlaceholderText('搜索链接...')
      await user.click(searchInput)
      
      expect(screen.getByText('↵')).toBeInTheDocument()
      expect(screen.queryByText('⌘K')).not.toBeInTheDocument()
    })
  })

  describe('Search Input Focus States', () => {
    it('should expand search input width on focus', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInput = screen.getByPlaceholderText('搜索链接...')
      
      await user.click(searchInput)
      
      expect(searchInput).toHaveClass('w-64')
    })

    it('should return to normal width on blur', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInput = screen.getByPlaceholderText('搜索链接...')
      
      await user.click(searchInput)
      expect(searchInput).toHaveClass('w-64')
      
      await user.click(document.body)
      
      await waitFor(() => {
        expect(searchInput).not.toHaveClass('w-64')
      })
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should focus search input when Cmd+K is pressed', async () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInput = screen.getByPlaceholderText('搜索链接...')
      
      fireEvent.keyDown(document, { key: 'k', metaKey: true })
      
      expect(searchInput).toHaveFocus()
    })

    it('should focus search input when Ctrl+K is pressed', async () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInput = screen.getByPlaceholderText('搜索链接...')
      
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
      
      expect(searchInput).toHaveFocus()
    })

    it('should blur search input when Cmd+K is pressed and input is already focused', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInput = screen.getByPlaceholderText('搜索链接...')
      
      // Focus the input first
      await user.click(searchInput)
      expect(searchInput).toHaveFocus()
      
      // Press Cmd+K to blur
      fireEvent.keyDown(document, { key: 'k', metaKey: true })
      
      expect(searchInput).not.toHaveFocus()
    })

    it('should blur search input when Escape is pressed while focused', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const searchInput = screen.getByPlaceholderText('搜索链接...')
      
      await user.click(searchInput)
      expect(searchInput).toHaveFocus()
      
      fireEvent.keyDown(document, { key: 'Escape' })
      
      expect(searchInput).not.toHaveFocus()
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
      
      const searchInput = screen.getByPlaceholderText('搜索链接...')
      
      // Test other key combinations that should not trigger focus
      fireEvent.keyDown(document, { key: 'j', metaKey: true })
      expect(searchInput).not.toHaveFocus()
      
      fireEvent.keyDown(document, { key: 'k' }) // Without meta/ctrl
      expect(searchInput).not.toHaveFocus()
    })
  })

  describe('Mobile Navigation', () => {
    it('should render mobile menu button on small screens', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const mobileMenuButton = document.querySelector('.dropdown.lg\\:hidden .btn')
      expect(mobileMenuButton).toBeInTheDocument()
      expect(mobileMenuButton).toHaveClass('btn', 'btn-ghost')
    })

    it('should render mobile dropdown menu items', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      // Mobile dropdown should contain Archive link
      const mobileArchiveLinks = screen.getAllByText('Archive')
      expect(mobileArchiveLinks.length).toBeGreaterThan(0)
    })
  })

  describe('Navigation Links', () => {
    it('should have correct logo link', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const logoLink = screen.getByText('Magpie').closest('a')
      expect(logoLink).toHaveAttribute('href', '/')
    })

    it('should have correct archive button link', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const archiveButton = screen.getByTitle('Archive')
      expect(archiveButton).toHaveAttribute('href', '/search')
    })

    it('should have hover effects on interactive elements', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const logoLink = screen.getByText('Magpie').closest('a')
      expect(logoLink).toHaveClass('hover:bg-white/10')
      
      const archiveButton = screen.getByTitle('Archive')
      expect(archiveButton).toHaveClass('hover:bg-white/10')
    })
  })

  describe('Logo Animation', () => {
    it('should have 3D flip animation on logo hover', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const logoImage = screen.getByAltText('Magpie')
      expect(logoImage).toHaveClass('group-hover:[transform:rotateY(180deg)]')
      expect(logoImage).toHaveStyle({ transformStyle: 'preserve-3d' })
    })
  })

  describe('Dropdown Menu', () => {
    it('should render dropdown menu items with correct styling', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const rssItem = screen.getByText('订阅RSS').closest('a')
      const aboutItem = screen.getByText('关于Magpie').closest('a')
      const themeItem = screen.getByText('切换颜色').closest('a')
      
      expect(rssItem).toHaveClass('flex', 'items-center', 'gap-3', 'hover:bg-slate-100')
      expect(aboutItem).toHaveClass('flex', 'items-center', 'gap-3', 'hover:bg-slate-100')
      expect(themeItem).toHaveClass('flex', 'items-center', 'gap-3', 'hover:bg-slate-100')
    })

    it('should have proper dropdown positioning', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const dropdown = screen.getByText('订阅RSS').closest('.dropdown-content')
      expect(dropdown).toHaveClass('dropdown-content')
      
      const dropdownContainer = document.querySelector('.dropdown.dropdown-end')
      expect(dropdownContainer).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA roles and attributes', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      // Search input should be accessible
      const searchInput = screen.getByPlaceholderText('搜索链接...')
      expect(searchInput).toHaveAttribute('type', 'text')
      
      // Mobile menu button should have tabIndex
      const mobileMenuButton = document.querySelector('.dropdown.lg\\:hidden [role="button"]')
      expect(mobileMenuButton).toHaveAttribute('tabIndex', '0')
    })

    it('should have proper form structure for screen readers', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const form = screen.getByPlaceholderText('搜索链接...').closest('form')
      expect(form).toBeInTheDocument()
    })

    it('should have descriptive titles', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      expect(screen.getByTitle('Archive')).toBeInTheDocument()
    })
  })

  describe('Logo Click Functionality', () => {
    it('should render logo as Link when onLogoClick is not provided', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} />)
      
      const logoLink = screen.getByText('Magpie').closest('a')
      expect(logoLink).toBeInTheDocument()
      expect(logoLink).toHaveAttribute('href', '/')
    })

    it('should render logo as button when onLogoClick is provided', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} onLogoClick={mockOnLogoClick} />)
      
      const logoButton = screen.getByText('Magpie').closest('button')
      expect(logoButton).toBeInTheDocument()
      expect(logoButton).toHaveClass('btn', 'btn-ghost', 'hover:bg-white/10', 'group')
    })

    it('should call onLogoClick when logo button is clicked', async () => {
      const user = userEvent.setup()
      render(<NavBarWithRouter onSearch={mockOnSearch} onLogoClick={mockOnLogoClick} />)
      
      const logoButton = screen.getByText('Magpie').closest('button')!
      
      await user.click(logoButton)
      
      expect(mockOnLogoClick).toHaveBeenCalledTimes(1)
    })

    it('should preserve logo styling when rendered as button', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} onLogoClick={mockOnLogoClick} />)
      
      const logoButton = screen.getByText('Magpie').closest('button')!
      const logoImage = screen.getByAltText('Magpie')
      const logoText = screen.getByText('Magpie')
      
      expect(logoButton).toHaveClass('btn', 'btn-ghost', 'hover:bg-white/10', 'group')
      expect(logoImage).toHaveClass('group-hover:[transform:rotateY(180deg)]')
      expect(logoImage).toHaveAttribute('src', '/magpie-icon.png')
      expect(logoText).toHaveClass('text-white', 'text-xl', 'font-bold')
    })
  })

  describe('Search Text Synchronization', () => {
    it('should initialize search input with initialSearchQuery', () => {
      const initialQuery = 'initial search'
      render(<NavBarWithRouter 
        onSearch={mockOnSearch} 
        initialSearchQuery={initialQuery} 
      />)
      
      const searchInput = screen.getByPlaceholderText('搜索链接...') as HTMLInputElement
      expect(searchInput.value).toBe(initialQuery)
    })

    it('should update search input when initialSearchQuery changes', () => {
      const initialQuery = 'first query'
      const { rerender } = render(<NavBarWithRouter 
        onSearch={mockOnSearch} 
        initialSearchQuery={initialQuery} 
      />)
      
      let searchInput = screen.getByPlaceholderText('搜索链接...') as HTMLInputElement
      expect(searchInput.value).toBe(initialQuery)
      
      // Re-render with new initial query
      const newQuery = 'updated query'
      rerender(<NavBarWithRouter 
        onSearch={mockOnSearch} 
        initialSearchQuery={newQuery} 
      />)
      
      searchInput = screen.getByPlaceholderText('搜索链接...') as HTMLInputElement
      expect(searchInput.value).toBe(newQuery)
    })

    it('should handle empty initialSearchQuery', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} initialSearchQuery="" />)
      
      const searchInput = screen.getByPlaceholderText('搜索链接...') as HTMLInputElement
      expect(searchInput.value).toBe('')
    })

    it('should handle undefined initialSearchQuery', () => {
      render(<NavBarWithRouter onSearch={mockOnSearch} initialSearchQuery={undefined} />)
      
      const searchInput = screen.getByPlaceholderText('搜索链接...') as HTMLInputElement
      expect(searchInput.value).toBe('')
    })

    it('should allow user to override synchronized search text', async () => {
      const user = userEvent.setup()
      const initialQuery = 'synced query'
      render(<NavBarWithRouter 
        onSearch={mockOnSearch} 
        initialSearchQuery={initialQuery} 
      />)
      
      const searchInput = screen.getByPlaceholderText('搜索链接...') as HTMLInputElement
      expect(searchInput.value).toBe(initialQuery)
      
      // User clears and types new query
      await user.clear(searchInput)
      await user.type(searchInput, 'user typed query')
      
      expect(searchInput.value).toBe('user typed query')
    })

    it('should sync search text and still submit correctly', async () => {
      const user = userEvent.setup()
      const initialQuery = 'github'
      render(<NavBarWithRouter 
        onSearch={mockOnSearch} 
        initialSearchQuery={initialQuery} 
      />)
      
      const searchInput = screen.getByPlaceholderText('搜索链接...') as HTMLInputElement
      expect(searchInput.value).toBe(initialQuery)
      
      // Submit without changing the value
      await user.type(searchInput, '{enter}')
      
      expect(mockOnSearch).toHaveBeenCalledWith(initialQuery)
    })
  })
})