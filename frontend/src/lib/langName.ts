import type { TFunction } from 'i18next'

// Standart katalog dillerinin adini UI diline gore dondurur (kod ile).
// Bilinmeyen (ad-hoc) kodlar icin DB'deki ada (fallback) duser.
export function langName(t: TFunction, code: string, fallback: string): string {
  return t(`langNames.${code}`, { defaultValue: fallback }) as string
}
