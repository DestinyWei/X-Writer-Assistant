import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { feedsApi, postsApi, type FeedItem } from '../api/client'
import { RefreshCw, ExternalLink, ChevronDown, ChevronUp, Loader2, X, Search } from 'lucide-react'
import clsx from 'clsx'

const REASON_TAGS = ['话题时效性强', '与AllScale业务相关', '数据/观点独特', '目标受众关注度高']
const LANG_LABELS: Record<string, string> = { zh: '中文', en: '英文' }

export default function FeedPool() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [filterTopic, setFilterTopic] = useState<string>('')
  const [filterLang, setFilterLang] = useState<string>('')
  const [searchKeyword, setSearchKeyword] = useState<string>('')
  const [showUsed, setShowUsed] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [selectingItem, setSelectingItem] = useState<FeedItem | null>(null)
  const [reasonTags, setReasonTags] = useState<string[]>([])
  const [reasonCustom, setReasonCustom] = useState('')
  const [postType, setPostType] = useState<'translate' | 'original'>('original')
  const [postFormat, setPostFormat] = useState<'tweet' | 'article'>('tweet')

  const { data, isLoading } = useQuery({
    queryKey: ['feeds', filterTopic, filterLang, showUsed, searchKeyword],
    queryFn: () =>
      feedsApi.list({
        topic: filterTopic || undefined,
        lang: filterLang || undefined,
        used: showUsed ? undefined : false,
        search: searchKeyword || undefined,
        limit: 60,
      }),
  })

  const { data: tags } = useQuery({ queryKey: ['feed-tags'], queryFn: feedsApi.tags })

  const refreshMutation = useMutation({
    mutationFn: feedsApi.refresh,
    onSuccess: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: ['feeds'] }), 2000)
    },
  })

  const generateMutation = useMutation({
    mutationFn: async (item: FeedItem) => {
      await feedsApi.select(item.id, { reason_tags: reasonTags, reason_custom: reasonCustom || undefined })
      return postsApi.generate({
        feed_item_id: item.id,
        post_type: postType,
        post_format: postFormat,
        selection_reasons: [...reasonTags, ...(reasonCustom ? [reasonCustom] : [])],
      })
    },
    onSuccess: (post) => {
      qc.invalidateQueries({ queryKey: ['feeds'] })
      setSelectingItem(null)
      navigate(`/workshop/${post.id}`)
    },
  })

  function openSelectModal(item: FeedItem) {
    setSelectingItem(item)
    setReasonTags([])
    setReasonCustom('')
    setPostType('original')
    setPostFormat('tweet')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">选题池</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data ? `${data.total} 条未使用` : '加载中...'}
          </p>
        </div>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-60 transition-colors"
        >
          <RefreshCw size={15} className={refreshMutation.isPending ? 'animate-spin' : ''} />
          {refreshMutation.isPending ? '抓取中...' : '刷新 RSS'}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          placeholder="搜索标题或摘要，如「payment」、「稳定币」..."
          className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
        {searchKeyword && (
          <button onClick={() => setSearchKeyword('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select
          value={filterLang}
          onChange={(e) => setFilterLang(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">全部语言</option>
          <option value="zh">中文</option>
          <option value="en">英文</option>
        </select>

        <button
          onClick={() => setFilterTopic('')}
          className={clsx(
            'text-sm px-3 py-1.5 rounded-full border transition-colors',
            !filterTopic ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300',
          )}
        >
          全部
        </button>
        {tags?.map((tag) => (
          <button
            key={tag}
            onClick={() => setFilterTopic(filterTopic === tag ? '' : tag)}
            className={clsx(
              'text-sm px-3 py-1.5 rounded-full border transition-colors',
              filterTopic === tag
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300',
            )}
          >
            {tag}
          </button>
        ))}

        <label className="flex items-center gap-1.5 text-sm text-gray-600 ml-auto cursor-pointer">
          <input type="checkbox" checked={showUsed} onChange={(e) => setShowUsed(e.target.checked)} />
          显示已使用
        </label>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-gray-400" size={28} />
        </div>
      ) : (
        <div className="space-y-3">
          {data?.items.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onSelect={() => openSelectModal(item)}
            />
          ))}
          {data?.items.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Newspaper size={40} className="mx-auto mb-3 opacity-30" />
              <p>暂无选题，点击「刷新 RSS」获取最新内容</p>
            </div>
          )}
        </div>
      )}

      {/* Selection Modal */}
      {selectingItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-start justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900">选用这篇选题</h2>
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{selectingItem.title}</p>
              </div>
              <button onClick={() => setSelectingItem(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Type & Format */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">生成模式</label>
                  <div className="flex gap-2">
                    {(['original', 'translate'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setPostType(t)}
                        className={clsx(
                          'flex-1 py-2 text-sm rounded-lg border font-medium transition-colors',
                          postType === t ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-200',
                        )}
                      >
                        {t === 'original' ? '原创撰写' : '翻译改写'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">发布格式</label>
                  <div className="flex gap-2">
                    {(['tweet', 'article'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setPostFormat(f)}
                        className={clsx(
                          'flex-1 py-2 text-sm rounded-lg border font-medium transition-colors',
                          postFormat === f ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-200',
                        )}
                      >
                        {f === 'tweet' ? '推文' : 'Article'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reason tags */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                  选择原因 <span className="text-gray-400 normal-case font-normal">（可选，帮助系统优化推荐）</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {REASON_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() =>
                        setReasonTags((prev) =>
                          prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                        )
                      }
                      className={clsx(
                        'text-sm px-3 py-1.5 rounded-full border transition-colors',
                        reasonTags.includes(tag)
                          ? 'bg-brand-100 text-brand-700 border-brand-300'
                          : 'bg-white text-gray-600 border-gray-200',
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <input
                  value={reasonCustom}
                  onChange={(e) => setReasonCustom(e.target.value)}
                  placeholder="补充说明（选填）"
                  className="mt-2 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setSelectingItem(null)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => generateMutation.mutate(selectingItem)}
                disabled={generateMutation.isPending}
                className="flex-1 py-2.5 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {generateMutation.isPending ? (
                  <><Loader2 size={15} className="animate-spin" /> 生成中...</>
                ) : (
                  '生成草稿'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FeedCard({
  item,
  expanded,
  onToggle,
  onSelect,
}: {
  item: FeedItem
  expanded: boolean
  onToggle: () => void
  onSelect: () => void
}) {
  return (
    <div className={clsx('bg-white rounded-xl border transition-shadow', item.used ? 'opacity-60' : 'hover:shadow-sm border-gray-200')}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {item.source}
              </span>
              <span className="text-xs text-gray-400">{LANG_LABELS[item.source_lang] ?? item.source_lang}</span>
              {item.used && (
                <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">已使用</span>
              )}
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-900 hover:text-brand-600 flex items-start gap-1 group"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="line-clamp-2">{item.title}</span>
              <ExternalLink size={12} className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
            {item.topic_tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {item.topic_tags.map((tag) => (
                  <span key={tag} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!item.used && (
              <button
                onClick={onSelect}
                className="text-sm px-3 py-1.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 font-medium transition-colors"
              >
                选用
              </button>
            )}
            <button onClick={onToggle} className="text-gray-400 hover:text-gray-600">
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-2">
          {item.summary && (
            <p className="text-sm text-gray-600 leading-relaxed">{item.summary}</p>
          )}
          {item.recommendation_reason && (
            <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
              推荐理由：{item.recommendation_reason}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Newspaper({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />
    </svg>
  )
}
