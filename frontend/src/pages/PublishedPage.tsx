import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { postsApi, type Post, type DiffItem } from '../api/client'
import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Loader2, ChevronDown, ChevronUp, CheckCircle2, X } from 'lucide-react'
import clsx from 'clsx'

const CATEGORY_COLORS: Record<string, string> = {
  语气调整: 'bg-purple-50 text-purple-700 border-purple-200',
  信息增减: 'bg-blue-50 text-blue-700 border-blue-200',
  本地化表达: 'bg-green-50 text-green-700 border-green-200',
  品牌调性: 'bg-orange-50 text-orange-700 border-orange-200',
  排版习惯: 'bg-pink-50 text-pink-700 border-pink-200',
  标签话题: 'bg-yellow-50 text-yellow-700 border-yellow-200',
}

export default function PublishedPage() {
  const qc = useQueryClient()
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [diffPostId, setDiffPostId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['posts', 'published'],
    queryFn: () => postsApi.list({ status: 'published' }),
  })

  const { data: diffData, isLoading: diffLoading } = useQuery({
    queryKey: ['diff', diffPostId],
    queryFn: () => postsApi.getDiff(diffPostId!),
    enabled: !!diffPostId,
    retry: false,
  })

  const [localDiffs, setLocalDiffs] = useState<DiffItem[]>([])

  function openDiff(postId: number) {
    setDiffPostId(postId)
    setLocalDiffs([])
  }

  function handleDiffLoaded() {
    if (diffData?.diff) {
      setLocalDiffs(diffData.diff.map((d) => ({ ...d, confirmed: true })))
    }
  }

  const confirmMutation = useMutation({
    mutationFn: () => postsApi.confirmDiff(diffPostId!, { confirmed_diffs: localDiffs }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diff', diffPostId] })
      setDiffPostId(null)
    },
  })

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">发布记录</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {data ? `${data.total} 篇已发布` : '加载中...'}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-gray-400" size={28} />
        </div>
      ) : (
        <div className="space-y-3">
          {data?.posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              expanded={expandedId === post.id}
              onToggle={() => setExpandedId(expandedId === post.id ? null : post.id)}
              onViewDiff={() => openDiff(post.id)}
            />
          ))}
          {data?.posts.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />
              <p>还没有发布记录</p>
            </div>
          )}
        </div>
      )}

      {/* Diff Modal */}
      {diffPostId && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">复盘分析</h2>
              <button onClick={() => setDiffPostId(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {diffLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-gray-400" size={28} />
              </div>
            ) : diffData ? (
              <div className="p-5 space-y-5">
                {/* Diff items */}
                {(localDiffs.length === 0 ? (handleDiffLoaded(), diffData.diff) : localDiffs).map((item, i) => (
                  <DiffCard
                    key={i}
                    item={item}
                    index={i}
                    onChange={(updated) =>
                      setLocalDiffs((prev) => {
                        const next = prev.length ? [...prev] : diffData.diff.map((d) => ({ ...d, confirmed: true }))
                        next[i] = updated
                        return next
                      })
                    }
                  />
                ))}

                {diffData.diff.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">初稿与最终发布稿几乎一致，无需调整</p>
                )}

                {!diffData.confirmed && diffData.diff.length > 0 && (
                  <button
                    onClick={() => {
                      if (localDiffs.length === 0) {
                        setLocalDiffs(diffData.diff.map((d) => ({ ...d, confirmed: true })))
                      }
                      confirmMutation.mutate()
                    }}
                    disabled={confirmMutation.isPending}
                    className="w-full py-2.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {confirmMutation.isPending ? (
                      <><Loader2 size={15} className="animate-spin" /> 保存中...</>
                    ) : (
                      '确认分析结果，保存为风格规则'
                    )}
                  </button>
                )}
                {diffData.confirmed && (
                  <p className="text-sm text-green-600 text-center bg-green-50 py-2 rounded-lg">
                    已确认并保存为风格规则
                  </p>
                )}
              </div>
            ) : (
              <div className="p-5 text-center text-gray-400 text-sm">
                Diff 分析尚未生成，请稍后再试
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PostCard({
  post,
  expanded,
  onToggle,
  onViewDiff,
}: {
  post: Post
  expanded: boolean
  onToggle: () => void
  onViewDiff: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">已发布</span>
              <span className="text-xs text-gray-400">
                {post.published_at
                  ? format(parseISO(post.published_at), 'yyyy年M月d日 HH:mm', { locale: zhCN })
                  : '—'}
              </span>
              <span className="text-xs text-gray-400">
                {post.post_type === 'translate' ? '翻译改写' : '原创撰写'} ·{' '}
                {post.post_format === 'tweet' ? '推文' : 'Article'}
              </span>
            </div>
            <p className="text-sm text-gray-800 line-clamp-3 leading-relaxed whitespace-pre-wrap">
              {post.final_content}
            </p>
          </div>
          <button onClick={onToggle} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
          {post.drafts && post.selected_draft_index !== null && post.drafts[post.selected_draft_index] && (
            <div>
              <p className="text-xs text-gray-400 mb-1">初始选定草稿（版本 {post.drafts[post.selected_draft_index]?.label}）</p>
              <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg leading-relaxed whitespace-pre-wrap">
                {post.drafts[post.selected_draft_index]?.content}
              </p>
            </div>
          )}
          <button
            onClick={onViewDiff}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            查看/确认复盘分析 →
          </button>
        </div>
      )}
    </div>
  )
}

function DiffCard({
  item,
  index,
  onChange,
}: {
  item: DiffItem & { confirmed?: boolean }
  index: number
  onChange: (updated: DiffItem & { confirmed?: boolean }) => void
}) {
  return (
    <div className={clsx(
      'rounded-xl border p-4 space-y-2 transition-opacity',
      !item.confirmed && 'opacity-50',
    )}>
      <div className="flex items-center justify-between">
        <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-medium', CATEGORY_COLORS[item.category] ?? 'bg-gray-100 text-gray-600 border-gray-200')}>
          {item.category}
        </span>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={item.confirmed !== false}
            onChange={(e) => onChange({ ...item, confirmed: e.target.checked })}
          />
          纳入规则库
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-400 mb-1">初稿</p>
          <p className="text-xs bg-red-50 text-red-700 p-2 rounded-lg leading-relaxed">{item.original}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">最终发布</p>
          <p className="text-xs bg-green-50 text-green-700 p-2 rounded-lg leading-relaxed">{item.modified}</p>
        </div>
      </div>
      <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">{item.analysis}</p>
    </div>
  )
}
