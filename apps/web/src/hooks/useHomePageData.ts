import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../utils/api'

// 将复杂的数据获取逻辑提取到自定义Hook
export function useHomePageData(
  page: number,
  selectedCategory: string | null,
  selectedTags: string[],
  searchQuery: string,
  enabled: boolean = true,
  linkId?: string
) {
  const [allLinks, setAllLinks] = useState<any[]>([])
  const [previousLinks, setPreviousLinks] = useState<any[]>([])

  // Fetch links data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['links', page, selectedCategory, selectedTags, searchQuery, linkId],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: page.toString()
      }
      
      if (selectedCategory) params.category = selectedCategory
      if (selectedTags.length > 0) params.tags = selectedTags.join(',')
      if (searchQuery) params.search = searchQuery
      if (linkId) params.id = linkId
      
      return await api.getLinks(params)
    },
    enabled,
    placeholderData: (previousData) => previousData,
    staleTime: 1 * 60 * 1000,
  })

  // Update links when data changes
  useEffect(() => {
    if (data && data.success) {
      if (page === 1) {
        setAllLinks(data.data.links)
      } else {
        setAllLinks(prev => [...prev, ...data.data.links])
      }
    }
  }, [data, page])

  // Show previous links during loading to prevent flash
  const displayLinks = (isLoading && page === 1 && previousLinks.length > 0) 
    ? previousLinks 
    : allLinks

  // Helper to preserve links before filtering
  const preserveLinksAndFilter = (action: () => void) => {
    if (allLinks.length > 0) {
      setPreviousLinks(allLinks)
    }
    action()
  }

  return {
    data,
    isLoading,
    error,
    refetch,
    displayLinks,
    preserveLinksAndFilter
  }
}