const SUMMARY_DICTIONARY = Object.freeze({
  'gemini asked what the lyrics were for': '[summarized] gemini asked about lyrics',
  'copilot suggested installing another extension': '[summarized] copilot suggested an extension',
  'meta tried to optimize the punchline': '[summarized] meta optimized the punchline',
  'the context window is getting nervous': '[summarized] context window panicking',
});

export function summarizeLyric(lyric) {
  if (typeof lyric !== 'string') return lyric;
  return SUMMARY_DICTIONARY[lyric] ?? lyric;
}

export function summarizeLyrics(lyrics) {
  if (!Array.isArray(lyrics)) return lyrics;
  return lyrics.map(summarizeLyric);
}
