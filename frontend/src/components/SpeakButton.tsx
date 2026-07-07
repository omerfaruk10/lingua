import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { canSpeak, SLOW_RATE, speak } from '../lib/speech'

// Sesler async yuklenir (Chrome): liste gelince yeniden render tetikle.
function useCanSpeak(code: string): boolean {
  const [, force] = useState(0)
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return
    const handler = () => force((n) => n + 1)
    speechSynthesis.addEventListener('voiceschanged', handler)
    return () => speechSynthesis.removeEventListener('voiceschanged', handler)
  }, [])
  return canSpeak(code)
}

// Hedef dilin TTS'iyle metni seslendiren buton cifti: normal (🔊) + yavas (🐢).
// O dil icin ses yoksa (ad-hoc diller) hic gorunmez.
export function SpeakButton({
  text,
  langCode,
  className = '',
}: {
  text: string
  langCode: string
  className?: string
}) {
  const { t } = useTranslation()
  const available = useCanSpeak(langCode)
  if (!available || !text.trim()) return null

  function play(e: React.MouseEvent, rate?: number) {
    e.stopPropagation() // kart tiklamasini tetiklemesin
    speak(text, langCode, rate)
  }

  return (
    <span className={`inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={(e) => play(e)}
        className="btn-icon text-base leading-none"
        title={t('words.speak')}
        aria-label={t('words.speak')}
      >
        🔊
      </button>
      <button
        type="button"
        onClick={(e) => play(e, SLOW_RATE)}
        className="btn-icon text-base leading-none"
        title={t('words.speakSlow')}
        aria-label={t('words.speakSlow')}
      >
        🐢
      </button>
    </span>
  )
}
