import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { scheduleApi, type CompactPost } from '../api/client'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { format, addDays, startOfWeek, addWeeks, subWeeks, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import clsx from 'clsx'

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  published: 'bg-green-100 text-green-700 border-green-200',
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: '已排期',
  published: '已发布',
  draft: '草稿',
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const [weekOffset, setWeekOffset] = useState(0)

  const baseMonday = startOfWeek(new Date(), { weekStartsOn: 1 })
  const currentMonday = weekOffset === 0
    ? baseMonday
    : weekOffset > 0
    ? addWeeks(baseMonday, weekOffset)
    : subWeeks(baseMonday, Math.abs(weekOffset))

  const weekStartStr = format(currentMonday, "yyyy-MM-dd'T'HH:mm:ss")

  const { data, isLoading } = useQuery({
    queryKey: ['schedule-week', weekStartStr],
    queryFn: () => scheduleApi.week(weekStartStr),
  })

  const days = Array.from({ length: 7 }, (_, i) => addDays(currentMonday, i))

  const totalPosts = data ? Object.values(data.days).flat().length : 0

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">排期日历</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(currentMonday, 'yyyy年M月d日', { locale: zhCN })} —{' '}
            {format(addDays(currentMonday, 6), 'M月d日', { locale: zhCN })}
            {totalPosts > 0 && ` · ${totalPosts} 篇`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            本周
          </button>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-gray-400" size={28} />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-3">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const posts = data?.days[key] ?? []
            const isToday = key === format(new Date(), 'yyyy-MM-dd')

            return (
              <div key={key} className="min-h-48">
                {/* Day header */}
                <div className={clsx(
                  'text-center py-2 rounded-lg mb-2',
                  isToday ? 'bg-brand-500 text-white' : 'bg-white border border-gray-200 text-gray-600',
                )}>
                  <div className="text-xs font-medium">
                    {format(day, 'EEE', { locale: zhCN })}
                  </div>
                  <div className={clsx('text-lg font-bold', isToday ? 'text-white' : 'text-gray-900')}>
                    {format(day, 'd')}
                  </div>
                </div>

                {/* Posts */}
                <div className="space-y-2">
                  {posts.map((post) => (
                    <CalendarCard
                      key={post.id}
                      post={post}
                      onClick={() => navigate(`/workshop/${post.id}`)}
                    />
                  ))}
                  {posts.length === 0 && (
                    <div className="h-20 border-2 border-dashed border-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-xs text-gray-300">空</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-6">
        <span className="text-xs text-gray-400">图例：</span>
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <span key={status} className={clsx('text-xs px-2 py-1 rounded-full border', STATUS_STYLES[status])}>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

function CalendarCard({ post, onClick }: { post: CompactPost; onClick: () => void }) {
  const time = post.scheduled_at
    ? format(parseISO(post.scheduled_at), 'HH:mm')
    : post.published_at
    ? format(parseISO(post.published_at), 'HH:mm')
    : null

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left p-2 rounded-lg border text-xs transition-opacity hover:opacity-80',
        STATUS_STYLES[post.status] ?? STATUS_STYLES.draft,
      )}
    >
      {time && <div className="font-medium mb-0.5">{time}</div>}
      <div className="line-clamp-3 leading-relaxed">{post.preview}</div>
      <div className="mt-1 flex items-center gap-1">
        <span className="opacity-70">{post.post_type === 'translate' ? '译' : '创'}</span>
        <span className="opacity-70">{post.post_format === 'article' ? '·长文' : ''}</span>
      </div>
    </button>
  )
}
