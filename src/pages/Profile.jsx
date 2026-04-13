import { useEffect, useMemo, useState } from 'react'
import TopBar from '../components/TopBar'
import { useT } from '../i18n'
import { profileApi } from '../lib/api'
import { getDisplayName, getPlanLabel } from '../lib/documents'

function StatTile({ label, value, hint }) {
  return (
    <div className="rounded-2xl pp-app-card p-5">
      <div className="text-xs font-medium uppercase tracking-[0.18em] pp-app-muted">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-white font-display">
        {value}
      </div>
      <div className="mt-1 text-sm pp-app-subtle">{hint}</div>
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
            className="text-xs px-3.5 py-2 rounded-lg border border-[rgba(255,118,105,0.22)] text-[#ffd6cf] hover:bg-[rgba(255,118,105,0.08)] transition-colors"
          >
            {t('auth.logout')}
          </button>
        )}
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-7">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-5">
            <section className="rounded-3xl pp-app-card p-6 sm:p-7">
              <div className="flex items-start gap-4 sm:gap-5">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-16 h-16 rounded-2xl object-cover border pp-app-border"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-[rgba(255,118,105,0.14)] text-[var(--pp-coral)] flex items-center justify-center text-xl font-semibold shrink-0 border border-[rgba(255,118,105,0.18)]">
                    {avatarLetter}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium uppercase tracking-[0.18em] pp-app-muted">{t('profile.account')}</div>
                  <h2 className="mt-2 text-2xl font-semibold text-white truncate font-display">
                    {profile?.full_name || displayName}
                  </h2>
                  <p className="mt-1 text-sm pp-app-subtle break-all">{profile?.email || user?.email || '-'}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[rgba(255,118,105,0.12)] px-3 py-1 text-xs font-medium text-[var(--pp-coral)] border border-[rgba(255,118,105,0.18)]">
                      {planLabel}
                    </span>
                    {joinedOn && (
                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs pp-app-subtle border pp-app-border">
                        {t('profile.joined', { date: joinedOn })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSave} className="mt-8">
                <label className="block text-xs font-medium pp-app-subtle mb-2">{t('profile.fullName')}</label>
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
                  className="w-full rounded-xl px-4 py-3 text-sm pp-app-input transition-all"
                />

                <div className="mt-3 text-xs pp-app-muted">
                  {t('profile.nameHint')}
                </div>

                {error && (
                  <div className="mt-4 rounded-xl border border-[rgba(255,118,105,0.2)] bg-[rgba(255,118,105,0.08)] px-4 py-3 text-sm text-[#ffd6cf]">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="mt-4 rounded-xl border border-[rgba(102,247,226,0.2)] bg-[rgba(102,247,226,0.08)] px-4 py-3 text-sm text-[var(--pp-cyan)]">
                    {success}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saving || appLoading}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-60 pp-app-button-primary"
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
                    className="px-4 py-2.5 rounded-xl border pp-app-border text-sm pp-app-subtle hover:bg-white/5 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-3xl pp-app-card p-6 sm:p-7">
              <div className="text-xs font-medium uppercase tracking-[0.18em] pp-app-muted">{t('profile.overview')}</div>
              <div className="mt-4 space-y-4 text-sm pp-app-subtle">
                <div className="flex items-center justify-between gap-4 border-b pp-app-border pb-4">
                  <span>{t('profile.email')}</span>
                  <span className="text-white break-all text-right">{profile?.email || user?.email || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b pp-app-border pb-4">
                  <span>{t('profile.plan')}</span>
                  <span className="text-white">{planLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b pp-app-border pb-4">
                  <span>{t('profile.uploadsUsed')}</span>
                  <span className="text-white">{profile?.uploads_this_month ?? 0}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>{t('profile.messagesToday')}</span>
                  <span className="text-white">{profile?.messages_today ?? 0}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="mt-8 w-full rounded-2xl border border-[rgba(255,118,105,0.22)] bg-[rgba(255,118,105,0.08)] px-4 py-3 text-sm font-medium text-[#ffd6cf] hover:bg-[rgba(255,118,105,0.12)] transition-colors"
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
