interface MonthSectionProps {
  year: number
  month: number
  count: number
  children: React.ReactNode
}

export default function MonthSection({ year, month, count, children }: MonthSectionProps) {
  const getChineseMonthName = (month: number) => {
    return `${month}月`
  }

  return (
    <section className="relative mb-8">
      {/* Month header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-base-content flex items-center gap-3">
          <span>{year}年 {getChineseMonthName(month)}</span>
          <span className="text-sm font-normal text-base-content/60 bg-base-200 px-2 py-1 rounded-full">
            {count} items
          </span>
        </h2>
      </div>

      {/* Content */}
      <div>
        {children}
      </div>
    </section>
  )
}