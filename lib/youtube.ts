/**
 * Extracts a YouTube Video ID from standard YouTube URLs, shorts, and share links.
 */
export function getYouTubeVideoId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

/**
 * Returns a privacy-enhanced YouTube embed URL.
 */
export function getYouTubeEmbedUrl(url: string | null): string | null {
  const id = getYouTubeVideoId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}
