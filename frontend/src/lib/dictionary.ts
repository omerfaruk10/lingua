export interface DictSuggestion {
  phonetic?: string
  part_of_speech?: string
  definition_target?: string
  example_sentence?: string
  meaning_native?: string
  synonyms?: string
  antonyms?: string
}

export async function fetchSuggestions(term: string, targetLangCode: string, nativeLangCode: string): Promise<DictSuggestion[]> {
  // Google Translate (GTx) gizli API'sini yedek sozluk olarak kullaniyoruz.
  // Tum dilleri destekler ve eger veritabaninda varsa kelimenin turlerini de dondurur.
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${targetLangCode}&tl=${nativeLangCode}&dt=t&dt=bd&q=${encodeURIComponent(term)}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    
    const out: DictSuggestion[] = []
    
    // data[1] varsa, kelimenin farkli turleri/anlamlari listelenmistir.
    if (data[1] && Array.isArray(data[1])) {
      for (const entry of data[1]) {
        const pos = entry[0] // orn: 'noun', 'verb' vb. (İngilizce doner genelde)
        const meanings = entry[1] // Diger dildeki olasi anlamlar dizisi
        if (meanings && meanings.length > 0) {
          out.push({
            part_of_speech: pos,
            meaning_native: String(meanings[0]).toLocaleLowerCase(nativeLangCode),
            synonyms: meanings.slice(1).map(String).map((s: string) => s.toLocaleLowerCase(nativeLangCode)).join(', ') || undefined,
          })
        }
      }
    } 
    // data[1] yoksa (sozluk verisi bos ise), sadece ceviri metnini tek sonuc olarak don.
    else if (data[0] && data[0][0] && data[0][0][0]) {
      out.push({
        meaning_native: String(data[0][0][0]).toLocaleLowerCase(nativeLangCode)
      })
    }
    
    return out
  } catch (e) {
    return []
  }
}
