import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { postsApi, type Draft } from '../api/client'
import { Check, Copy, Loader2, CalendarClock, Send, ChevronLeft } from 'lucide-react'
import clsx from 'clsx'

const DRAFT_REASON_TAGS = ['语气符合品牌调性', '信息密度合适', '结构排版清晰', '更容易引发互动']

export default function DraftWorkshop() {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [reasonTags, setReasonTags] = useState<string[]>([])
  const [reasonCustom, setReasonCustom] = useState('')
  const [editContent, setEditContent] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [copied, setCopied] = useState(false)
  const [phase, setPhase] = useState<'pick' | 'edit'>('pick')

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => postsApi.get(Number(postId)),
    enabled: !!postId,
    staleTime: 0,
  })

  const selectDraftMutation = useMutation({
    mutationFn: (idx: number) =>
      postsApi.selectDraft(Number(postId), {
        draft_index: idx,
        reason_tags: reasonTags,
        reason_custom: reasonCustom || undefined,
      }),
    onSuccess: (updated) => {
      qc.setQueryData(['post', postId], updated)
      setEditContent(updated.final_content || '')
      setPhase('edit')
    },
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      postsApi.update(Number(postId), {
        final_content: editContent,
        scheduled_at: scheduledAt || undefined,
      }),
    onSuccess: (updated) => {
      qc.setQueryData(['post', postId], updated)
    },
  })

  const publishMutation = useMutation({
    mutationFn: () => postsApi.publish(Number(postId)),
    onSuccess: () => {
      navigate('/published')
    },
  })

  function handleCopy() {
    navigator.clipboard.writeText(editContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSelectDraft(idx: number) {
    setSelectedIdx(idx)
  }

  function confirmDraftSelection() {
    if (selectedIdx === null) return
    selectDraftMutation.mutate(selectedIdx)
  }

  if (!postId) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="text-center py-20 text-gray-400">
          <p className="mb-4">请先从选题池选择一条选题</p>
          <button
            onClick={() => navigate('/feeds')}
            className="text-sm px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600"
          >
            前往选题池
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  if (!post) return null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/feeds')} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={22} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">草稿工坊</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {post.post_type === 'translate' ? '翻译改写' : '原创撰写'} ·{' '}
            {post.post_format === 'tweet' ? '推文' : 'Article'}
          </p>
        </div>
      </div>

      {phase === 'pick' ? (
        /* ── Phase 1: Pick a draft ── */
        <div className="space-y-5">
          <p className="text-sm text-gray-600 bg-blue-50 px-4 py-2.5 rounded-lg">
            以下是 Claude 生成的 {post.drafts.length} 个版本，请选择最合适的一个进入编辑
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {post.drafts.map((draft: Draft, idx: number) => (
              <DraftCard
                key={idx}
                draft={draft}
                index={idx}
                selected={selectedIdx === idx}
                onSelect={() => handleSelectDraft(idx)}
              />
            ))}
          </div>

          {selectedIdx !== null && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                  为什么选这个版本？<span className="text-gray-400 normal-case font-normal">（可选）</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {DRAFT_REASON_TAGS.map((tag) => (
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
              <button
                onClick={confirmDraftSelection}
                disabled={selectDraftMutation.isPending}
                className="w-full py-2.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {selectDraftMutation.isPending ? (
                  <><Loader2 size={15} className="animate-spin" /> 处理中...</>
                ) : (
                  <>选用版本 {post.drafts[selectedIdx]?.label} 进入编辑</>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ── Phase 2: Edit & Schedule ── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Editor */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-700">编辑草稿</span>
                <button
                  onClick={() => setPhase('pick')}
                  className="text-xs text-gray-400 hover:text-brand-600"
                >
                  重新选版本
                </button>
              </div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={post.post_format === 'article' ? 20 : 10}
                className="w-full px-4 py-3 text-sm text-gray-900 resize-none focus:outline-none leading-relaxed"
                placeholder="在此编辑推文内容..."
              />
              <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-400">{editContent.length} 字符</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
                >
                  {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                  {copied ? '已复制' : '复制内容'}
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar: Schedule + Actions */}
          <div className="space-y-4">
            {/* Schedule */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <CalendarClock size={15} />
                排期设置
              </h3>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <p className="text-xs text-gray-400 mt-1.5">留空则为立即发布</p>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="w-full py-2.5 text-sm font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-60"
              >
                {saveMutation.isPending ? '保存中...' : '保存草稿'}
              </button>

              <button
                onClick={handleCopy}
                className="w-full py-2.5 text-sm font-medium border border-brand-200 text-brand-700 bg-brand-50 rounded-lg hover:bg-brand-100 flex items-center justify-center gap-2"
              >
                <Copy size={14} />
                复制推文文本
              </button>

              <button
                onClick={async () => {
                  await saveMutation.mutateAsync()
                  publishMutation.mutate()
                }}
                disabled={publishMutation.isPending || saveMutation.isPending}
                className="w-full py-2.5 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {publishMutation.isPending ? (
                  <><Loader2 size={15} className="animate-spin" /> 处理中...</>
                ) : (
                  <><Send size={14} /> 标记为已发布</>
                )}
              </button>

              <p className="text-xs text-gray-400 text-center">
                Phase 1a：请手动复制发布到 X，<br />然后点击「标记为已发布」
              </p>
            </div>

            {/* Original draft comparison */}
            {post.selected_draft_index !== null && post.drafts[post.selected_draft_index] && (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">初始选定版本</h3>
                <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {post.drafts[post.selected_draft_index].content}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DraftCard({
  draft,
  index,
  selected,
  onSelect,
}: {
  draft: Draft
  index: number
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={clsx(
        'text-left w-full rounded-xl border-2 p-4 transition-all',
        selected ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white hover:border-brand-300',
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={clsx(
            'text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center',
            selected ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600',
          )}>
            {draft.label}
          </span>
          <span className="text-xs text-gray-500">{draft.style_note}</span>
        </div>
        {selected && <Check size={16} className="text-brand-500" />}
      </div>
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap line-clamp-6">
        {draft.content}
      </p>
    </button>
  )
}
