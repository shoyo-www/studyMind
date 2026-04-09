import { useEffect, useMemo, useState } from 'react'
import TopBar from '../components/TopBar'
import { useT } from '../i18n'
import { profileApi } from '../lib/api'
import { getDisplayName, getPlanLabel } from '../lib/documents'

function StatTile({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-zinc-900" style={{ fontFamily: 'Syne,sans-serif' }}>
        {value}
      </div>
      <div className="mt-1 text-sm text-zinc-500">{hint}</div>
    </div>
  )
}

export default function Profile({
  onOpenSidebar,
  user,
  profile,
  stats,
  onLogout,
  refreshAppData,
  appLoading,
}) {
  const { t, lang } = useT()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setFullName(profile?.full_name || '')
  }, [profile?.full_name])

  const displayName = getDisplayName(profile, user)
  const planLabel = getPlanLabel(profile?.plan, lang)
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || ''
  const avatarLetter = displayName.charAt(0).toUpperCase() || 'S'
  const joinedOn = useMemo(() => {
    const source = user?.created_at || profile?.created_at
    if (!source) return null
    const date = new Date(source)
    if (Number.isNaN(date.getTime())) return null
    return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date)
  }, [lang, profile?.created_at, user?.created_at])

  async function handleSave(event) {
    event.preventDefault()
    const nextFullName = fullName.trim()

    if (!nextFullName) {
      setError(t('profile.errors.nameRequired'))
      setSuccess('')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await profileApi.update({ fullName: nextFullName })
      await refreshAppData?.()
      setSuccess(t('profile.saved'))
    } catch (saveError) {
      setError(saveError.message || t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TopBar
        onOpenSidebar={onOpenSidebar}
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
        action={(
          <button
            onClick={onLogout}
            className="text-xs px-3.5 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
          >
            {t('auth.logout')}
          </button>
        )}
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-7 bg-zinc-50">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-5">
            <section className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-7">
              <div className="flex items-start gap-4 sm:gap-5">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-16 h-16 rounded-2xl object-cover border border-zinc-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center text-xl font-semibold shrink-0">
                    {avatarLetter}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">{t('profile.account')}</div>
                  <h2 className="mt-2 text-2xl font-semibold text-zinc-900 truncate" style={{ fontFamily: 'Syne,sans-serif' }}>
                    {profile?.full_name || displayName}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500 break-all">{profile?.email || user?.email || '-'}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                      {planLabel}
                    </span>
                    {joinedOn && (
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500">
                        {t('profile.joined', { date: joinedOn })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSave} className="mt-8">
                <label className="block text-xs font-medium text-zinc-600 mb-2">{t('profile.fullName')}</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => {
                    setFullName(event.target.value)
                    if (error) setError('')
                    if (success) setSuccess('')
                  }}
                  placeholder={t('profile.namePlaceholder')}
                  maxLength={80}
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-800 outline-none transition-all focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                />

                <div className="mt-3 text-xs text-zinc-400">
                  {t('profile.nameHint')}
                </div>

                {error && (
                  <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {success}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saving || appLoading}
                    className="px-4 py-2.5 rounded-xl bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-700 transition-colors disabled:opacity-60"
                  >
                    {saving ? t('profile.saving') : t('common.save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFullName(profile?.full_name || '')
                      setError('')
                      setSuccess('')
                    }}
                    className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-7">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">{t('profile.overview')}</div>
              <div className="mt-4 space-y-4 text-sm text-zinc-600">
                <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                  <span>{t('profile.email')}</span>
                  <span className="text-zinc-900 break-all text-right">{profile?.email || user?.email || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                  <span>{t('profile.plan')}</span>
                  <span className="text-zinc-900">{planLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                  <span>{t('profile.uploadsUsed')}</span>
                  <span className="text-zinc-900">{profile?.uploads_this_month ?? 0}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>{t('profile.messagesToday')}</span>
                  <span className="text-zinc-900">{profile?.messages_today ?? 0}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="mt-8 w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
              >
                {t('profile.logoutCta')}
              </button>
            </section>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
            <StatTile
              label={t('profile.stats.documents')}
              value={String(stats?.documentCount ?? 0)}
              hint={t('profile.stats.documentsHint')}
            />
            <StatTile
              label={t('profile.stats.topics')}
              value={String(stats?.totalTopics ?? 0)}
              hint={t('profile.stats.topicsHint')}
            />
            <StatTile
              label={t('profile.stats.quizAverage')}
              value={`${stats?.averageQuizScore ?? 0}%`}
              hint={t('profile.stats.quizAverageHint')}
            />
            <StatTile
              label={t('profile.stats.readiness')}
              value={`${stats?.readinessPct ?? 0}%`}
              hint={t('profile.stats.readinessHint')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
