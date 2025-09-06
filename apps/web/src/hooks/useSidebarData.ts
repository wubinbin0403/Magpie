import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../utils/api'
import type { ApiResponse, LinksResponse, Category } from '@magpie/shared'

interface SidebarData {
  categories: (Category & { count: number })[]
  tags: { name: string; count: number }[]
}

// 将sidebar数据处理逻辑提取到自定义Hook  
export function useSidebarData(
  selectedCategory: string | null,
  linksData: ApiResponse<LinksResponse> | undefined
) {
  const [sidebarData, setSidebarData] = useState<SidebarData>({ 
    categories: [], 
    tags: [] 
  })

  // Fetch categories data
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.getCategories()
      return response.data
    },
    staleTime: 5 * 60 * 1000,
  })

  // 简化的sidebar数据更新逻辑
  useEffect(() => {
    if (!Array.isArray(categoriesData)) return

    if (linksData?.success && linksData.data.filters) {
      // 有links数据时，合并计数信息
      const categoriesWithCounts = categoriesData.map(category => {
        const categoryFilter = linksData.data.filters.categories.find(
          f => f.name === category.name
        )
        return {
          ...category,
          count: categoryFilter?.count || 0
        }
      })

      setSidebarData({
        categories: categoriesWithCounts,
        tags: linksData.data.filters.tags || []
      })
    } else if (sidebarData.categories.length === 0) {
      // 初始化时设置零计数
      const categoriesWithZeroCounts = categoriesData.map(category => ({ 
        ...category, 
        count: 0 
      }))
      
      setSidebarData({
        categories: categoriesWithZeroCounts,
        tags: []
      })
    }
  }, [categoriesData, linksData?.success, linksData?.data.filters])

  return { sidebarData, categoriesData }
}