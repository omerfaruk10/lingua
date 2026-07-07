// Tarayicinin yerlesik TTS'i (Web Speech API) ile kelime seslendirme.
// Kelimenin sozlukte olmasi gerekmez: utterance.lang hangi dilin fonetik
// motorunun kullanilacagini belirler, kullanicinin girdigi HER metin o dilin
// okuma kurallarina gore seslendirilir. Ucretsiz, dis servis yok, offline calisir.

const BCP47: Record<string, string> = {
  tr: 'tr-TR',
  en: 'en-US',
  it: 'it-IT',
  es: 'es-ES',
  de: 'de-DE',
  fr: 'fr-FR',
}

function bcp47(code: string): string {
  return BCP47[code.toLowerCase()] ?? code
}

function normalizeTag(lang: string): string {
  return lang.toLowerCase().replace('_', '-')
}

let cachedVoices: SpeechSynthesisVoice[] = []

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === 'undefined') return []
  const v = speechSynthesis.getVoices()
  if (v.length > 0) cachedVoices = v
  return cachedVoices
}

// Chrome seslerini async yukler; listeyi bastan isit ve degisince tazele.
if (typeof speechSynthesis !== 'undefined') {
  loadVoices()
  speechSynthesis.addEventListener?.('voiceschanged', () => loadVoices())
}

export function pickVoice(code: string): SpeechSynthesisVoice | null {
  const target = normalizeTag(bcp47(code))
  const prefix = target.split('-')[0]
  const candidates = loadVoices().filter((v) => normalizeTag(v.lang).startsWith(prefix))
  if (candidates.length === 0) return null
  const exact = candidates.filter((v) => normalizeTag(v.lang) === target)
  const pool = exact.length > 0 ? exact : candidates
  // Edge'in "Natural" sesleri belirgin sekilde daha iyi; yoksa varsayilan ses.
  return pool.find((v) => /natural/i.test(v.name)) ?? pool.find((v) => v.default) ?? pool[0]
}

// Ad-hoc/uydurma dillerde (orn. katalog disi 'ielts') ses bulunmaz; buton gizlenir.
export function canSpeak(code: string): boolean {
  return pickVoice(code) !== null
}

// Hizlar kullanici geri bildirimiyle ayarlandi: TTS'in "1.0"i dogal konusmadan
// hizli algilaniyor; 0.55 normal konusma gibi geliyor, 0.3 hece calismasi icin.
export const NORMAL_RATE = 0.55
export const SLOW_RATE = 0.3

export function speak(text: string, code: string, rate = NORMAL_RATE): void {
  if (typeof speechSynthesis === 'undefined') return
  speechSynthesis.cancel() // onceki okuma bitmeden yenisi baslarsa kes
  const u = new SpeechSynthesisUtterance(text)
  const voice = pickVoice(code)
  if (voice) u.voice = voice
  u.lang = bcp47(code)
  u.rate = rate
  speechSynthesis.speak(u)
}
