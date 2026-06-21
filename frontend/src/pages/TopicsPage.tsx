import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useLanguageId } from '../components/WorkspaceLayout'
import {
  useCreateTopic,
  useDeleteTopic,
  useTopics,
  useUpdateTopic,
} from '../hooks/useTopics'
import type { TopicStatus } from '../types'

const NEXT_STATUS: Record<TopicStatus, TopicStatus> = {
  not_started: 'in_progress',
  in_progress: 'done',
  done: 'not_started',
}

const STATUS_STYLE: Record<TopicStatus, string> = {
  not_started: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
  in_progress: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  done: 'bg-green-100 text-green-700 hover:bg-green-200',
}

export function TopicsPage() {
  const { t } = useTranslation()
  const languageId = useLanguageId()
  const { data: topics, isLoading } = useTopics(languageId)
  const createTopic = useCreateTopic(languageId)
  const updateTopic = useUpdateTopic(languageId)
  const deleteTopic = useDeleteTopic(languageId)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const list = topics ?? []
  const doneCount = list.filter((x) => x.status === 'done').length

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    createTopic.mutate(
      { title: title.trim(), description: description.trim() || null, order_index: list.length },
      {
        onSuccess: () => {
          setTitle('')
          setDescription('')
        },
      },
    )
  }

  function cycleStatus(topicId: number, current: TopicStatus) {
    updateTopic.mutate({ topicId, data: { status: NEXT_STATUS[current] } })
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= list.length) return
    const a = list[index]
    const b = list[j]
    updateTopic.mutate({ topicId: a.id, data: { order_index: b.order_index } })
    updateTopic.mutate({ topicId: b.id, data: { order_index: a.order_index } })
  }

  function remove(topicId: number) {
    if (confirm(t('topics.deleteConfirm'))) deleteTopic.mutate(topicId)
  }

  return (
    <div className="space-y-5">
      {list.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${(doneCount / list.length) * 100}%` }}
            />
          </div>
          <span className="text-sm text-slate-500">
            {t('topics.progress', { done: doneCount, total: list.length })}
          </span>
        </div>
      )}

      {isLoading ? (
        <p className="text-slate-400">{t('common.loading')}</p>
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-400">
          {t('topics.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((topic, index) => (
            <li
              key={topic.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex flex-col text-slate-300">
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="leading-none hover:text-violet-600 disabled:opacity-30"
                  title={t('topics.moveUp')}
                >
                  ▲
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === list.length - 1}
                  className="leading-none hover:text-violet-600 disabled:opacity-30"
                  title={t('topics.moveDown')}
                >
                  ▼
                </button>
              </div>

              <button
                onClick={() => cycleStatus(topic.id, topic.status)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${STATUS_STYLE[topic.status]}`}
              >
                {t(`status.${topic.status}`)}
              </button>

              <div className="flex-1">
                <div
                  className={`font-medium ${topic.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'}`}
                >
                  {topic.title}
                </div>
                {topic.description && (
                  <div className="text-sm text-slate-500">{topic.description}</div>
                )}
              </div>

              <button
                onClick={() => remove(topic.id)}
                className="rounded-lg px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title={t('common.delete')}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Konu ekleme */}
      <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-800">{t('topics.addTitle')}</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('topics.titlePlaceholder')}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('topics.descPlaceholder')}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
          />
          <button
            type="submit"
            disabled={createTopic.isPending}
            className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {t('topics.add')}
          </button>
        </div>
      </form>
    </div>
  )
}
