import { useEffect, useState } from 'react'

const DEFAULT_STEPS = [
  'Reading your notes',
  'Pulling out the key points',
  'Writing the answer',
]

export default function GeneratingIndicator({
  compact = false,
  label = 'Generating answer',
  steps = DEFAULT_STEPS,
}) {
  const safeSteps = steps.length ? steps : DEFAULT_STEPS
  const [stepIndex, setStepIndex] = useState(0)
  const [charCount, setCharCount] = useState(0)
  const activeStep = safeSteps[stepIndex] || ''

  useEffect(() => {
    setStepIndex(0)
    setCharCount(0)
  }, [safeSteps])

  useEffect(() => {
    const isComplete = charCount >= activeStep.length
    const timer = setTimeout(() => {
      if (isComplete) {
        setStepIndex((current) => (current + 1) % safeSteps.length)
        setCharCount(0)
        return
      }

      setCharCount((current) => current + 1)
    }, isComplete ? 850 : 34)

    return () => clearTimeout(timer)
  }, [activeStep, charCount, safeSteps.length])

  return (
    <div className={compact ? 'min-w-[180px]' : 'min-w-[220px]'}>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="w-1.5 h-1.5 rounded-full bg-[var(--pp-coral)] animate-bounce"
              style={{ animationDelay: `${index * 0.15}s` }}
            />
          ))}
        </div>
        <span className={`font-medium uppercase tracking-[0.18em] pp-app-muted ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          {label}
        </span>
      </div>

      <div className={`mt-2 flex items-center pp-app-subtle ${compact ? 'text-[12px]' : 'text-sm'}`}>
        <span className="truncate">{activeStep.slice(0, charCount) || ' '}</span>
        <span className="ml-0.5 text-[var(--pp-cyan)] animate-pulse">|</span>
      </div>
    </div>
  )
}
