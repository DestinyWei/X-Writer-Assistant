const BASE = ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

// ── Feeds ──────────────────────────────────────────────────────────────
export const feedsApi = {
  list: (params?: { topic?: string; used?: boolean; lang?: string; search?: string; skip?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.topic) qs.set('topic', params.topic)
    if (params?.used !== undefined) qs.set('used', String(params.used))
    if (params?.lang) qs.set('lang', params.lang)
    if (params?.search) qs.set('q', params.search)
    if (params?.skip !== undefined) qs.set('skip', String(params.skip))
    if (params?.limit !== undefined) qs.set('limit', String(params.limit))
    return request<{ total: number; items: FeedItem[] }>(`/feeds?${qs}`)
  },
  refresh: () => request<{ message: string }>('/feeds/refresh', { method: 'POST' }),
  select: (id: number, body: { reason_tags: string[]; reason_custom?: string }) =>
    request<FeedItem>(`/feeds/${id}/select`, { method: 'POST', body: JSON.stringify(body) }),
  tags: () => request<string[]>('/feeds/tags'),
}

// ── Posts ──────────────────────────────────────────────────────────────
export const postsApi = {
  generate: (body: {
    feed_item_id?: number
    post_type: string
    post_format: string
    selection_reasons?: string[]
  }) => request<Post>('/posts/generate', { method: 'POST', body: JSON.stringify(body) }),

  list: (params?: { status?: string }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    return request<{ total: number; posts: Post[] }>(`/posts?${q}`)
  },

  get: (id: number) => request<Post>(`/posts/${id}`),

  selectDraft: (id: number, body: { draft_index: number; reason_tags: string[]; reason_custom?: string }) =>
    request<Post>(`/posts/${id}/select-draft`, { method: 'POST', body: JSON.stringify(body) }),

  update: (id: number, body: { final_content?: string; scheduled_at?: string; status?: string }) =>
    request<Post>(`/posts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  publish: (id: number) => request<{ message: string; post: Post }>(`/posts/${id}/publish`, { method: 'POST' }),

  getDiff: (id: number) => request<DiffRecord>(`/posts/${id}/diff`),

  confirmDiff: (id: number, body: { confirmed_diffs: DiffItem[] }) =>
    request<{ message: string }>(`/posts/${id}/diff/confirm`, { method: 'POST', body: JSON.stringify(body) }),
}

// ── Schedule ───────────────────────────────────────────────────────────
export const scheduleApi = {
  week: (weekStart?: string) => {
    const q = weekStart ? `?week_start=${weekStart}` : ''
    return request<WeekSchedule>(`/schedule/week${q}`)
  },
  rules: () => request<StyleRule[]>('/schedule/rules'),
  updateRule: (id: number, body: Partial<StyleRule>) =>
    request<{ message: string }>(`/schedule/rules/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteRule: (id: number) =>
    request<{ message: string }>(`/schedule/rules/${id}`, { method: 'DELETE' }),
}

// ── Types ──────────────────────────────────────────────────────────────
export interface FeedItem {
  id: number
  source: string
  source_lang: string
  title: string
  url: string
  summary: string
  topic_tags: string[]
  recommendation_reason: string
  selection_reason_tags: string[]
  selection_reason_custom: string
  fetched_at: string
  published_at: string | null
  used: boolean
}

export interface Draft {
  label: string
  style_note: string
  content: string
}

export interface Post {
  id: number
  feed_item_id: number | null
  post_type: string
  post_format: string
  drafts: Draft[]
  selected_draft_index: number | null
  draft_selection_reason_tags: string[]
  draft_selection_reason_custom: string
  final_content: string
  status: string
  scheduled_at: string | null
  published_at: string | null
  created_at: string
}

export interface DiffItem {
  original: string
  modified: string
  category: string
  analysis: string
  confirmed?: boolean
}

export interface DiffRecord {
  id: number
  post_id: number
  original_draft: string
  final_content: string
  diff: DiffItem[]
  confirmed: boolean
}

export interface StyleRule {
  id: number
  category: string
  rule_text: string
  examples: { before: string; after: string }[]
  enabled: boolean
  weight: number
  created_at: string
}

export interface WeekSchedule {
  week_start: string
  week_end: string
  days: Record<string, CompactPost[]>
}

export interface CompactPost {
  id: number
  post_type: string
  post_format: string
  preview: string
  status: string
  scheduled_at: string | null
  published_at: string | null
}
