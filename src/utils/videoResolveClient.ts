import type { ResolvedVideoMetadata } from '../types/workspace';
import { isValidHttpUrl, normalizeUrl, parseVideoUrl } from './pathLogic';

export async function resolveVideoMetadata(rawUrl: string): Promise<ResolvedVideoMetadata> {
  const cleanUrl = normalizeUrl(rawUrl);
  const parsed = parseVideoUrl(cleanUrl);

  if (!isValidHttpUrl(cleanUrl)) {
    return {
      resolved: false,
      url: rawUrl.trim(),
      platformId: parsed.platformId,
      platformName: parsed.platformName,
      title: '',
      description: '',
      thumbnailUrl: parsed.autoThumbnailUrl || '',
      authorName: '',
    };
  }

  try {
    const res = await fetch('/api/videos/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cleanUrl }),
    });

    if (res.ok) {
      const data = (await res.json()) as Partial<ResolvedVideoMetadata>;
      return {
        resolved: Boolean(data.resolved),
        url: data.url || parsed.normalizedUrl,
        platformId: data.platformId || parsed.platformId,
        platformName: data.platformName || parsed.platformName,
        title: typeof data.title === 'string' ? data.title : '',
        description: typeof data.description === 'string' ? data.description : '',
        thumbnailUrl:
          typeof data.thumbnailUrl === 'string' && data.thumbnailUrl
            ? data.thumbnailUrl
            : parsed.autoThumbnailUrl || '',
        authorName: typeof data.authorName === 'string' ? data.authorName : '',
      };
    }
  } catch {
    // Fallback gracefully to client URL inspection
  }

  return {
    resolved: Boolean(parsed.autoThumbnailUrl),
    url: parsed.normalizedUrl,
    platformId: parsed.platformId,
    platformName: parsed.platformName,
    title: '',
    description: '',
    thumbnailUrl: parsed.autoThumbnailUrl || '',
    authorName: '',
  };
}
