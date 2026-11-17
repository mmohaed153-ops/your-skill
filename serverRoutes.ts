import type { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dns from 'node:dns/promises';
import net from 'node:net';

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtmlTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' '));
}

function normalizeHttpUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    if (!parsed.hostname.includes('.')) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function isPrivateIpAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) return true;
    if (lower.startsWith('::ffff:')) {
      return isPrivateIpAddress(lower.slice(7));
    }
  }
  return false;
}

async function isSafePublicUrl(urlStr: string): Promise<boolean> {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.localhost')
    ) {
      return false;
    }
    if (net.isIP(host)) {
      return !isPrivateIpAddress(host);
    }
    const resolved = await dns.lookup(host, { all: true }).catch(() => []);
    if (resolved.length === 0) return true;
    return resolved.every((entry) => !isPrivateIpAddress(entry.address));
  } catch {
    return false;
  }
}

// ==================== Game Jam Finder Handlers ====================

export type ServerJamStatus = 'upcoming' | 'active' | 'newly_announced' | 'ended';
export type ServerJamMode = 'online' | 'in_person' | 'hybrid';

export interface ServerGameJamItem {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: ServerJamStatus;
  mode: ServerJamMode;
  location: string;
  theme: string;
  platform: string;
  organizer: string;
  officialUrl: string;
  thumbnailUrl: string;
  participantsCount: number;
  tags: string[];
  beginnerFriendly: boolean;
  sourceName: string;
  sourceUrl: string;
  infoUpdatedAt: string;
}

export interface ServerJamUpdateItem {
  id: string;
  title: string;
  summary: string;
  updateType: 'newly_announced' | 'starting_soon' | 'active_now' | 'theme_update' | 'deadline';
  jamName: string;
  officialUrl: string;
  platform: string;
  updateDate: string;
  sourceName: string;
}

function computeEndDate(startIso: string, durationText: string): string {
  if (!startIso) return '';
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return '';
  const match = durationText.trim().match(/(\d+(?:\.\d+)?)\s*(hour|day|week|month)/i);
  if (!match) return '';
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  let hours = 0;
  if (unit.startsWith('hour')) hours = amount;
  else if (unit.startsWith('day')) hours = amount * 24;
  else if (unit.startsWith('week')) hours = amount * 24 * 7;
  else if (unit.startsWith('month')) hours = amount * 24 * 30;
  if (hours <= 0) return '';
  return new Date(start.getTime() + hours * 3600 * 1000).toISOString();
}

function parseItchJamsHtml(
  html: string,
  feedUrl: string,
  defaultStatus: ServerJamStatus,
  fetchedAtIso: string
): ServerGameJamItem[] {
  const parts = html.split('<div class="jam">');
  if (parts.length <= 1) return [];

  const results: ServerGameJamItem[] = [];
  const seenUrls = new Set<string>();

  for (let i = 1; i < parts.length && results.length < 24; i++) {
    const chunk = parts[i].slice(0, 2600);
    const titleMatch = chunk.match(
      /<h3[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i
    );
    if (!titleMatch?.[1] || !titleMatch?.[2]) continue;

    const rawHref = decodeHtmlEntities(titleMatch[1]);
    const officialUrl = normalizeHttpUrl(
      rawHref.startsWith('http') ? rawHref : `https://itch.io${rawHref}`
    );
    const name = stripHtmlTags(titleMatch[2]).slice(0, 200);
    if (!officialUrl || !name || seenUrls.has(officialUrl)) continue;
    seenUrls.add(officialUrl);

    const imgSrcMatch = chunk.match(/<div class="jam_cover"[\s\S]*?<img[^>]*src="([^"]+)"/i);
    const srcsetMatch = chunk.match(/<div class="jam_cover"[\s\S]*?srcset="([^"]+)"/i);
    let thumbnailUrl = imgSrcMatch?.[1] ? decodeHtmlEntities(imgSrcMatch[1]) : '';
    if (srcsetMatch?.[1]) {
      const candidates = srcsetMatch[1].split(',').map((s) => s.trim().split(/\s+/)[0]);
      if (candidates[1]) thumbnailUrl = decodeHtmlEntities(candidates[1]);
    }
    thumbnailUrl = normalizeHttpUrl(thumbnailUrl);

    const hostedMatch = chunk.match(/<div class="hosted_by[^"]*">([\s\S]*?)<\/div>/i);
    const organizer = hostedMatch?.[1]
      ? stripHtmlTags(hostedMatch[1]).replace(/^Hosted by\s*/i, '').trim().slice(0, 140)
      : 'itch.io Community';

    const dateMatch = chunk.match(/class="date_countdown"[^>]*>([^<]+)</i);
    const rawDateIso = dateMatch?.[1] ? decodeHtmlEntities(dateMatch[1]) : '';
    const durationMatch = chunk.match(/class="date_duration"[^>]*>([^<]+)</i);
    const durationText = durationMatch?.[1] ? stripHtmlTags(durationMatch[1]) : '';

    const isActiveBlock = /Submission closes in/i.test(chunk) || /Judging/i.test(chunk);
    const isStartingSoonBlock = /Starts in/i.test(chunk);

    let status: ServerJamStatus = defaultStatus;
    let startDate = '';
    let endDate = '';

    if (isActiveBlock) {
      status = 'active';
      endDate = rawDateIso;
    } else if (isStartingSoonBlock) {
      status = defaultStatus === 'newly_announced' ? 'newly_announced' : 'upcoming';
      startDate = rawDateIso;
      endDate = computeEndDate(rawDateIso, durationText);
    }

    const joinedMatch = chunk.match(/<span class="number">([\d,]+)<\/span>\s*joined/i);
    const participantsCount = joinedMatch?.[1]
      ? Number(joinedMatch[1].replace(/,/g, '')) || 0
      : 0;

    const isFeatured = /featured_flag/i.test(chunk);
    const isRanked = /jam_ranked/i.test(chunk);
    const tags: string[] = ['itch.io'];
    if (isFeatured) tags.push('مميزة');
    if (isRanked) tags.push('Ranked');
    if (durationText) tags.push(durationText);

    const lowerName = name.toLowerCase();
    const beginnerFriendly =
      /(beginner|first|mini|micro|starter|learn|cozy|easy|jam for all|student)/.test(lowerName);
    if (beginnerFriendly) tags.push('مناسبة للمبتدئين');

    const descParts: string[] = [];
    if (organizer) descParts.push(`من تنظيم ${organizer}.`);
    if (durationText) descParts.push(`مدة المسابقة: ${durationText}.`);
    if (participantsCount > 0) {
      descParts.push(`عدد المشاركين المسجلين: ${participantsCount.toLocaleString()}.`);
    }

    const slug = officialUrl.split('/').pop() || `jam_${i}`;
    results.push({
      id: `itch_${slug.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)}`,
      name,
      description: descParts.join(' ') || 'مسابقة تطوير ألعاب مفتوحة للمشاركة عبر منصة itch.io.',
      startDate,
      endDate,
      status,
      mode: 'online',
      location: 'أونلاين (itch.io)',
      theme: 'يُعلن رسمياً في صفحة المسابقة',
      platform: 'itch.io',
      organizer,
      officialUrl,
      thumbnailUrl,
      participantsCount,
      tags,
      beginnerFriendly,
      sourceName: 'itch.io Game Jams',
      sourceUrl: feedUrl,
      infoUpdatedAt: fetchedAtIso,
    });
  }

  return results;
}

async function fetchItchFeed(
  feedUrl: string,
  defaultStatus: ServerJamStatus,
  fetchedAtIso: string
): Promise<ServerGameJamItem[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    const res = await fetch(feedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const html = await res.text();
    return parseItchJamsHtml(html, feedUrl, defaultStatus, fetchedAtIso);
  } catch {
    return [];
  }
}

function parseNaturalIntentServer(rawQuery: string): {
  cleanQuery: string;
  inferredStatus: 'all' | 'upcoming' | 'active' | 'newly_announced';
  inferredMode: 'all' | 'online' | 'in_person';
  inferredLocation: string;
  beginnerOnly: boolean;
  searchKeyword: string;
} {
  const cleanQuery = rawQuery.trim();
  const lower = cleanQuery.toLowerCase();

  let inferredStatus: 'all' | 'upcoming' | 'active' | 'newly_announced' = 'all';
  if (/(currently active|active right now|happening right now|in progress|نشط|جارية الآن|تحدث الآن|حالية)/.test(lower)) {
    inferredStatus = 'active';
  } else if (/(upcoming|starting soon|next|قريباً|قادمة)/.test(lower)) {
    inferredStatus = 'upcoming';
  } else if (/(newly announced|recent|new jam|أعلنت حديثاً|معلنة حديثاً)/.test(lower)) {
    inferredStatus = 'newly_announced';
  }

  let inferredMode: 'all' | 'online' | 'in_person' = 'all';
  if (/(online|remote|عبر الإنترنت|أونلاين|اونلاين)/.test(lower)) {
    inferredMode = 'online';
  } else if (/(in-person|in person|near me|\bnear\b|local|حضوري|قريب مني|بالقرب من|محلي)/.test(lower)) {
    inferredMode = 'in_person';
  }

  let inferredLocation = '';
  const nearMatch = cleanQuery.match(/(?:in|near|at|في|بالقرب من)\s+([a-zA-Z\u0600-\u06FF\s]{2,40})$/i);
  if (nearMatch?.[1]) {
    const candidate = nearMatch[1].trim();
    if (!/^(me|the world|beginners|online|مبتدئين|أونلاين)$/i.test(candidate)) {
      inferredLocation = candidate;
      if (inferredMode === 'all') inferredMode = 'in_person';
    }
  }

  const beginnerOnly = /(beginner|beginners|first jam|starter|مبتدئ|للمبتدئين|بسيط)/.test(lower);

  // Extract concise English topic keyword if present for itch.io search
  let searchKeyword = cleanQuery
    .replace(/(find a game jam|show|what game jams are|currently active|for beginners|near me|online|game jam|game jams|مسابقة|مسابقات|تطوير الألعاب|ألعاب|قريباً|جارية الآن|أونلاين|للمبتدئين|قريب مني)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!searchKeyword && beginnerOnly) {
    searchKeyword = 'beginner';
  }
  if (/[\u0600-\u06FF]/.test(searchKeyword)) {
    if (/(جودوت|godot)/i.test(cleanQuery)) searchKeyword = 'godot';
    else if (/(يونيتي|unity)/i.test(cleanQuery)) searchKeyword = 'unity';
    else if (/(أنريل|unreal)/i.test(cleanQuery)) searchKeyword = 'unreal';
    else if (/(بيكسل|pixel|2d)/i.test(cleanQuery)) searchKeyword = 'pixel';
    else if (/(رعب|horror)/i.test(cleanQuery)) searchKeyword = 'horror';
    else if (/(ثلاثي|3d)/i.test(cleanQuery)) searchKeyword = '3d';
    else searchKeyword = '';
  }

  return {
    cleanQuery,
    inferredStatus,
    inferredMode,
    inferredLocation,
    beginnerOnly,
    searchKeyword,
  };
}

function parseJamJsonArrayFromGemini(rawText: string): Array<Record<string, unknown>> {
  const trimmed = rawText.trim();
  const candidates: string[] = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.unshift(fenced[1].trim());
  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    candidates.push(trimmed.slice(firstBracket, lastBracket + 1));
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>;
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { jams?: unknown }).jams)) {
        return (parsed as { jams: Array<Record<string, unknown>> }).jams;
      }
    } catch {
      // try next candidate
    }
  }
  return [];
}

async function searchGeminiGameJams(params: {
  query: string;
  status: string;
  mode: string;
  location: string;
  topic: string;
  fetchedAtIso: string;
}): Promise<ServerGameJamItem[]> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return [];

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const searchPrompt = [
    params.query ? `User search: "${params.query}".` : '',
    params.topic ? `Game dev topic: "${params.topic}".` : '',
    params.location ? `Location preference: "${params.location}".` : '',
    params.mode !== 'all' ? `Event mode: ${params.mode}.` : '',
    params.status !== 'all' ? `Event status: ${params.status}.` : '',
    'Today is ' + params.fetchedAtIso.slice(0, 10) + '.',
  ]
    .filter(Boolean)
    .join(' ');

  const systemInstruction = `You are a live Game Jam research assistant.
Use Google Search to find ONLY real, verified Game Jams (from itch.io/jams, globalgamejam.org, ldjam.com, devpost.com, university or regional game jams, etc.).
CRITICAL RULES:
- NEVER invent, fabricate, or guess fake Game Jams or URLs. Every returned jam MUST come from actual search results with a real official URL.
- If no real Game Jam matches the exact query/location, return an empty JSON array [].
Return ONLY a valid JSON array of up to 8 real Game Jams with exact fields:
[
  {
    "name": "Official Game Jam name",
    "description": "Concise 1-2 sentence factual summary",
    "startDate": "YYYY-MM-DD or ISO date if known, else empty string",
    "endDate": "YYYY-MM-DD or ISO date if known, else empty string",
    "status": "upcoming | active | newly_announced | ended",
    "mode": "online | in_person | hybrid",
    "location": "City/Country or Online",
    "theme": "Official theme if announced, else empty string",
    "platform": "itch.io | Global Game Jam | Ludum Dare | Devpost | Organizer site",
    "organizer": "Host or organizer name",
    "officialUrl": "Direct verified https URL from search",
    "beginnerFriendly": true or false
  }
]`;

  const candidateModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `${searchPrompt}\nSearch Google and return real matching Game Jams as JSON.`,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
        },
      });

      const rawItems = parseJamJsonArrayFromGemini(response.text || '');
      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const fallbackSources = groundingChunks
        .map((c) => normalizeHttpUrl(c.web?.uri))
        .filter(Boolean);

      const mapped = rawItems
        .map((item, idx): ServerGameJamItem | null => {
          const name = String(item.name || '').trim().slice(0, 200);
          const officialUrl = normalizeHttpUrl(item.officialUrl) || fallbackSources[idx] || '';
          if (!name || !officialUrl) return null;

          const statusRaw = String(item.status || '').toLowerCase();
          const status: ServerJamStatus =
            statusRaw === 'active'
              ? 'active'
              : statusRaw === 'newly_announced'
                ? 'newly_announced'
                : statusRaw === 'ended'
                  ? 'ended'
                  : 'upcoming';

          const modeRaw = String(item.mode || '').toLowerCase();
          const mode: ServerJamMode =
            modeRaw === 'in_person' || modeRaw === 'in-person'
              ? 'in_person'
              : modeRaw === 'hybrid'
                ? 'hybrid'
                : 'online';

          const platform = String(item.platform || 'Web').trim().slice(0, 120) || 'Web';
          return {
            id: `gem_${Date.now().toString(36)}_${idx}`,
            name,
            description: String(item.description || '').trim().slice(0, 600),
            startDate: String(item.startDate || '').trim().slice(0, 64),
            endDate: String(item.endDate || '').trim().slice(0, 64),
            status,
            mode,
            location:
              String(item.location || '').trim().slice(0, 140) ||
              (mode === 'online' ? 'أونلاين عالمياً' : 'حضوري'),
            theme: String(item.theme || '').trim().slice(0, 180) || 'يُعلن في صفحة المسابقة',
            platform,
            organizer: String(item.organizer || platform).trim().slice(0, 140),
            officialUrl,
            thumbnailUrl: '',
            participantsCount: 0,
            tags: [platform, mode === 'online' ? 'أونلاين' : 'حضوري'],
            beginnerFriendly: Boolean(item.beginnerFriendly),
            sourceName: 'Google Web Search',
            sourceUrl: officialUrl,
            infoUpdatedAt: params.fetchedAtIso,
          };
        })
        .filter((x): x is ServerGameJamItem => Boolean(x));

      if (mapped.length > 0) return mapped;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err || '');
      console.warn(`[GameJam Search - ${modelName}]`, msg.replace(/AIza[0-9A-Za-z_-]{10,}/g, '[REDACTED]').slice(0, 200));
    }
  }
  return [];
}

export async function handleGameJamSearch(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as {
    query?: string;
    status?: 'all' | 'upcoming' | 'active' | 'newly_announced';
    mode?: 'all' | 'online' | 'in_person';
    location?: string;
    topic?: string;
    beginnerOnly?: boolean;
  };

  const rawQuery = typeof body.query === 'string' ? body.query.trim() : '';
  const intent = parseNaturalIntentServer(rawQuery);
  const effectiveStatus =
    body.status && body.status !== 'all' ? body.status : intent.inferredStatus;
  const effectiveMode =
    body.mode && body.mode !== 'all' ? body.mode : intent.inferredMode;
  const effectiveLocation = (typeof body.location === 'string' ? body.location.trim() : '') || intent.inferredLocation;
  const effectiveTopic = typeof body.topic === 'string' ? body.topic.trim() : '';
  const beginnerOnly = Boolean(body.beginnerOnly) || intent.beginnerOnly;
  const fetchedAtIso = new Date().toISOString();

  // Decide which live feeds to fetch
  const searchTerms = Array.from(
    new Set([effectiveTopic, intent.searchKeyword].map((s) => s.trim()).filter(Boolean))
  );

  const feedPromises: Promise<ServerGameJamItem[]>[] = [];
  if (searchTerms.length > 0 && effectiveMode !== 'in_person') {
    for (const term of searchTerms.slice(0, 2)) {
      feedPromises.push(
        fetchItchFeed(
          `https://itch.io/search?type=jams&q=${encodeURIComponent(term)}`,
          effectiveStatus === 'active' ? 'active' : 'upcoming',
          fetchedAtIso
        )
      );
    }
  }

  if (effectiveStatus === 'active' || effectiveStatus === 'all') {
    feedPromises.push(fetchItchFeed('https://itch.io/jams/in-progress', 'active', fetchedAtIso));
  }
  if (effectiveStatus === 'upcoming' || effectiveStatus === 'all') {
    feedPromises.push(fetchItchFeed('https://itch.io/jams/upcoming', 'upcoming', fetchedAtIso));
  }
  if (effectiveStatus === 'newly_announced' || effectiveStatus === 'all') {
    feedPromises.push(
      fetchItchFeed('https://itch.io/jams/starting-this-month', 'newly_announced', fetchedAtIso)
    );
  }

  const geminiPromise = searchGeminiGameJams({
    query: rawQuery,
    status: effectiveStatus,
    mode: effectiveMode,
    location: effectiveLocation,
    topic: effectiveTopic,
    fetchedAtIso,
  });

  const [itchBatches, geminiJams] = await Promise.all([
    Promise.all(feedPromises),
    geminiPromise,
  ]);

  // Merge & deduplicate by normalized officialUrl
  const mergedMap = new Map<string, ServerGameJamItem>();
  for (const jam of [...geminiJams, ...itchBatches.flat()]) {
    const key = jam.officialUrl.replace(/\/$/, '').toLowerCase();
    if (!mergedMap.has(key)) {
      mergedMap.set(key, jam);
    }
  }

  let combined = Array.from(mergedMap.values());

  // Apply explicit filters faithfully — never fabricate matches
  if (effectiveStatus !== 'all') {
    const matchedStatus = combined.filter((j) =>
      effectiveStatus === 'newly_announced'
        ? j.status === 'newly_announced' || j.status === 'upcoming'
        : j.status === effectiveStatus
    );
    combined = matchedStatus;
  }

  if (effectiveMode === 'online') {
    combined = combined.filter((j) => j.mode === 'online' || j.mode === 'hybrid');
  } else if (effectiveMode === 'in_person') {
    combined = combined.filter((j) => j.mode === 'in_person' || j.mode === 'hybrid');
  }

  if (effectiveLocation) {
    const locLower = effectiveLocation.toLowerCase();
    combined = combined.filter(
      (j) =>
        j.location.toLowerCase().includes(locLower) ||
        j.name.toLowerCase().includes(locLower) ||
        j.description.toLowerCase().includes(locLower)
    );
  }

  if (beginnerOnly) {
    const beg = combined.filter((j) => j.beginnerFriendly);
    if (beg.length > 0) combined = beg;
  }

  if (effectiveTopic && effectiveMode !== 'in_person') {
    const topicLower = effectiveTopic.toLowerCase();
    const topicFiltered = combined.filter(
      (j) =>
        j.name.toLowerCase().includes(topicLower) ||
        j.description.toLowerCase().includes(topicLower) ||
        j.organizer.toLowerCase().includes(topicLower) ||
        j.tags.some((t) => t.toLowerCase().includes(topicLower))
    );
    combined = topicFiltered;
  } else if (searchTerms.length > 0 && geminiJams.length === 0 && effectiveMode !== 'in_person') {
    // When itch search already ran with specific query, prioritize matching items first
    const kw = searchTerms[0].toLowerCase();
    combined.sort((a, b) => {
      const aMatch =
        a.name.toLowerCase().includes(kw) || a.description.toLowerCase().includes(kw) ? 1 : 0;
      const bMatch =
        b.name.toLowerCase().includes(kw) || b.description.toLowerCase().includes(kw) ? 1 : 0;
      return bMatch - aMatch || b.participantsCount - a.participantsCount;
    });
    // If user typed a specific jam name/keyword not found in itch search results, enforce strict match
    const hasSpecificWord = kw.length >= 4 && !['beginner', 'online'].includes(kw);
    if (hasSpecificWord) {
      combined = combined.filter(
        (j) =>
          j.name.toLowerCase().includes(kw) ||
          j.description.toLowerCase().includes(kw) ||
          j.organizer.toLowerCase().includes(kw)
      );
    }
  }

  const finalJams = combined.slice(0, 12);
  const relatedSuggestions = [
    'Show online Game Jams',
    'What Game Jams are currently active?',
    'Find a Game Jam for beginners',
    'Godot',
  ];

  res.json({
    jams: finalJams,
    totalFound: finalJams.length,
    infoUpdatedAt: fetchedAtIso,
    relatedSuggestions,
    summary:
      finalJams.length > 0
        ? `تم جلب ${finalJams.length} مسابقة حقيقية من المصادر المباشرة (${fetchedAtIso.slice(0, 10)}).`
        : 'لم يتم العثور على مسابقات حقيقية مطابقة تماماً لهذه الشروط حالياً. جرّب أحد البحثات البديلة أدناه.',
  });
}

let cachedUpdates: {
  fetchedAt: number;
  payload: { updates: ServerJamUpdateItem[]; fetchedAt: string; sourceName: string };
} | null = null;

export async function handleGameJamUpdates(req: Request, res: Response): Promise<void> {
  const forceRefresh = req.query.refresh === '1';
  const now = Date.now();
  if (!forceRefresh && cachedUpdates && now - cachedUpdates.fetchedAt < 5 * 60 * 1000) {
    res.json(cachedUpdates.payload);
    return;
  }

  const fetchedAtIso = new Date().toISOString();
  const [activeJams, startingSoonJams, featuredUpcoming] = await Promise.all([
    fetchItchFeed('https://itch.io/jams/in-progress', 'active', fetchedAtIso),
    fetchItchFeed('https://itch.io/jams/starting-this-month', 'newly_announced', fetchedAtIso),
    fetchItchFeed('https://itch.io/jams/upcoming/featured', 'upcoming', fetchedAtIso),
  ]);

  const updates: ServerJamUpdateItem[] = [];
  const seen = new Set<string>();

  for (const jam of activeJams.slice(0, 4)) {
    if (seen.has(jam.officialUrl)) continue;
    seen.add(jam.officialUrl);
    updates.push({
      id: `upd_act_${jam.id}`,
      title: `مسابقة جارية الآن: ${jam.name}`,
      summary: `${jam.organizer ? `تنظيم ${jam.organizer} · ` : ''}${jam.endDate ? `آخر موعد للتسليم: ${jam.endDate.slice(0, 10)}` : 'التسليم مفتوح حالياً'}${jam.participantsCount > 0 ? ` · ${jam.participantsCount.toLocaleString()} مشارك` : ''}.`,
      updateType: jam.endDate ? 'deadline' : 'active_now',
      jamName: jam.name,
      officialUrl: jam.officialUrl,
      platform: jam.platform,
      updateDate: fetchedAtIso,
      sourceName: 'itch.io In-Progress Feed',
    });
  }

  for (const jam of startingSoonJams.slice(0, 4)) {
    if (seen.has(jam.officialUrl)) continue;
    seen.add(jam.officialUrl);
    updates.push({
      id: `upd_soon_${jam.id}`,
      title: `تبدأ قريباً هذا الشهر: ${jam.name}`,
      summary: `${jam.startDate ? `موعد البدء: ${jam.startDate.slice(0, 10)} · ` : ''}${jam.organizer ? `تنظيم ${jam.organizer}` : ''}.`,
      updateType: 'starting_soon',
      jamName: jam.name,
      officialUrl: jam.officialUrl,
      platform: jam.platform,
      updateDate: fetchedAtIso,
      sourceName: 'itch.io Starting This Month',
    });
  }

  for (const jam of featuredUpcoming.slice(0, 4)) {
    if (seen.has(jam.officialUrl)) continue;
    seen.add(jam.officialUrl);
    updates.push({
      id: `upd_feat_${jam.id}`,
      title: `مسابقة مميزة معلنة: ${jam.name}`,
      summary: `${jam.organizer ? `تنظيم ${jam.organizer} · ` : ''}${jam.participantsCount > 0 ? `${jam.participantsCount.toLocaleString()} مشترك مسجل حتى الآن.` : 'التسجيل مفتوح عبر الصفحة الرسمية.'}`,
      updateType: 'newly_announced',
      jamName: jam.name,
      officialUrl: jam.officialUrl,
      platform: jam.platform,
      updateDate: fetchedAtIso,
      sourceName: 'itch.io Featured Upcoming Jams',
    });
  }

  const payload = {
    updates,
    fetchedAt: fetchedAtIso,
    sourceName: 'itch.io Live Game Jam Feeds',
  };

  if (updates.length > 0) {
    cachedUpdates = { fetchedAt: now, payload };
  }
  res.json(payload);
}

// ==================== Multi-Platform Video Metadata Resolver ====================

function detectPlatformServer(url: string): { platformId: string; platformName: string } {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^(www\.|m\.|mobile\.)/, '').toLowerCase();
    if (host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
      return { platformId: 'youtube', platformName: 'YouTube' };
    }
    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
      return { platformId: 'tiktok', platformName: 'TikTok' };
    }
    if (host === 'facebook.com' || host === 'fb.watch' || host === 'fb.com' || host.endsWith('.facebook.com')) {
      return { platformId: 'facebook', platformName: 'Facebook' };
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      return { platformId: 'vimeo', platformName: 'Vimeo' };
    }
    if (host === 'twitch.tv' || host === 'clips.twitch.tv' || host.endsWith('.twitch.tv')) {
      return { platformId: 'twitch', platformName: 'Twitch' };
    }
    if (host === 'loom.com' || host.endsWith('.loom.com')) {
      return { platformId: 'loom', platformName: 'Loom' };
    }
    if (host === 'dailymotion.com' || host === 'dai.ly') {
      return { platformId: 'dailymotion', platformName: 'Dailymotion' };
    }
    if (host === 'x.com' || host === 'twitter.com') {
      return { platformId: 'x_twitter', platformName: 'X / Twitter' };
    }
    if (/\.(mp4|webm|ogg|m4v)(\?.*)?$/i.test(url)) {
      return { platformId: 'direct', platformName: 'ملف فيديو مباشر' };
    }
    return { platformId: 'external', platformName: host || 'منصة خارجية' };
  } catch {
    return { platformId: 'external', platformName: 'رابط فيديو' };
  }
}

function extractMetaTag(html: string, key: string): string {
  const re1 = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
    'i'
  );
  const m = html.match(re1) || html.match(re2);
  return m?.[1] ? decodeHtmlEntities(m[1]) : '';
}

export async function handleVideoMetadataResolve(req: Request, res: Response): Promise<void> {
  const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  const normalizedUrl = normalizeHttpUrl(rawUrl);
  if (!normalizedUrl) {
    res.status(400).json({ error: 'يرجى إدخال رابط فيديو صحيح يبدأ بـ https://.' });
    return;
  }

  const { platformId, platformName } = detectPlatformServer(normalizedUrl);
  const safe = await isSafePublicUrl(normalizedUrl);
  if (!safe) {
    res.json({
      resolved: false,
      url: normalizedUrl,
      platformId,
      platformName,
      title: '',
      description: '',
      thumbnailUrl: '',
      authorName: '',
    });
    return;
  }

  let title = '';
  let description = '';
  let thumbnailUrl = '';
  let authorName = '';

  const oembedTargets: Partial<Record<string, string>> = {
    youtube: `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`,
    tiktok: `https://www.tiktok.com/oembed?url=${encodeURIComponent(normalizedUrl)}`,
    vimeo: `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(normalizedUrl)}`,
  };

  const oembedUrl = oembedTargets[platformId];
  if (oembedUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const r = await fetch(oembedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (r.ok) {
        const data = (await r.json()) as {
          title?: string;
          thumbnail_url?: string;
          author_name?: string;
        };
        title = String(data.title || '').trim().slice(0, 200);
        thumbnailUrl = normalizeHttpUrl(data.thumbnail_url);
        authorName = String(data.author_name || '').trim().slice(0, 120);
      }
    } catch {
      // fallback to HTML meta tags
    }
  }

  if (!title && platformId !== 'direct') {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const r = await fetch(normalizedUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; MasarVideoPreview/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      const contentType = r.headers.get('content-type') || '';
      if (r.ok && contentType.includes('text/html')) {
        const html = (await r.text()).slice(0, 180000);
        title =
          extractMetaTag(html, 'og:title') ||
          extractMetaTag(html, 'twitter:title') ||
          (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
            ? stripHtmlTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)![1])
            : '');
        title = title.slice(0, 200);
        description = (
          extractMetaTag(html, 'og:description') ||
          extractMetaTag(html, 'description') ||
          ''
        ).slice(0, 500);
        thumbnailUrl =
          normalizeHttpUrl(extractMetaTag(html, 'og:image')) ||
          normalizeHttpUrl(extractMetaTag(html, 'twitter:image')) ||
          thumbnailUrl;
      }
    } catch {
      // graceful fallback
    }
  }

  res.json({
    resolved: Boolean(title || thumbnailUrl),
    url: normalizedUrl,
    platformId,
    platformName,
    title,
    description,
    thumbnailUrl,
    authorName,
  });
}

// ==================== Interactive AI Quiz Generator ====================

export interface GeneratedQuizQuestionPayload {
  id: string;
  type: 'multiple_choice' | 'true_false';
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export async function handleQuizGenerate(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as {
    lessonTitle?: unknown;
    lessonDescription?: unknown;
    quickNotes?: unknown;
    questionCount?: unknown;
    difficulty?: unknown;
    language?: unknown;
  };

  const lessonTitle = typeof body.lessonTitle === 'string' ? body.lessonTitle.trim().slice(0, 180) : '';
  const lessonDescription =
    typeof body.lessonDescription === 'string' ? body.lessonDescription.trim().slice(0, 1000) : '';
  const quickNotes =
    typeof body.quickNotes === 'string' ? body.quickNotes.trim().slice(0, 3000) : '';
  const requestedCount = Math.max(3, Math.min(10, Math.round(Number(body.questionCount) || 5)));
  const difficulty =
    body.difficulty === 'easy' || body.difficulty === 'hard' ? body.difficulty : 'medium';
  const language = body.language === 'en' ? 'en' : 'ar';

  if (lessonTitle.length < 2) {
    res.status(400).json({ error: 'يرجى تحديد عنوان الدرس لتوليد الاختبار.' });
    return;
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    res.status(503).json({
      error:
        'ميزة توليد الأسئلة الذكي تتطلب تفعيل مفتاح GEMINI_API_KEY في الخادم. يمكنك إنشاء اختبار مخصص يدوياً في أي وقت.',
    });
    return;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const promptContext = [
    `Lesson Title: ${lessonTitle}`,
    lessonDescription ? `Lesson Description: ${lessonDescription}` : '',
    quickNotes ? `Student Notes: ${quickNotes}` : '',
    `Question Count: ${requestedCount}`,
    `Difficulty: ${difficulty}`,
    `Output Language: ${language === 'ar' ? 'Arabic (with technical terms in English when appropriate)' : 'English'}`,
  ]
    .filter(Boolean)
    .join('\n');

  const systemInstruction = `You are an expert educational assessment designer.
Create a realistic, concise interactive quiz strictly grounded in the lesson title, description, and student notes provided.
Include a mix of multiple_choice (4 clear options, 1 correct) and true_false (2 options: "${language === 'ar' ? 'صح' : 'True'}" and "${language === 'ar' ? 'خطأ' : 'False'}").
Provide a short educational explanation for the correct answer in each question.`;

  const candidateModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
  let lastErrDetail = '';

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `Generate ${requestedCount} interactive quiz questions for this lesson:\n${promptContext}`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              quizTitle: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, enum: ['multiple_choice', 'true_false'] },
                    prompt: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING },
                  },
                  required: ['type', 'prompt', 'options', 'correctIndex', 'explanation'],
                },
              },
            },
            required: ['quizTitle', 'questions'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}') as {
        quizTitle?: unknown;
        questions?: Array<Record<string, unknown>>;
      };

      const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
      const sanitized: GeneratedQuizQuestionPayload[] = rawQuestions
        .map((q, idx): GeneratedQuizQuestionPayload | null => {
          const qType = q.type === 'true_false' ? 'true_false' : 'multiple_choice';
          const prompt = String(q.prompt || '').trim().slice(0, 400);
          if (!prompt) return null;

          const rawOptions = Array.isArray(q.options)
            ? q.options.map((o) => String(o || '').trim().slice(0, 220)).filter(Boolean)
            : [];

          const options =
            qType === 'true_false'
              ? rawOptions.length >= 2
                ? rawOptions.slice(0, 2)
                : [language === 'ar' ? 'صح' : 'True', language === 'ar' ? 'خطأ' : 'False']
              : rawOptions.slice(0, 4);

          if (qType === 'multiple_choice' && options.length < 2) return null;

          const rawIdx = Number(q.correctIndex);
          const correctIndex =
            Number.isInteger(rawIdx) && rawIdx >= 0 && rawIdx < options.length ? rawIdx : 0;

          return {
            id: `qq_${Date.now().toString(36)}_${idx}`,
            type: qType,
            prompt,
            options,
            correctIndex,
            explanation:
              String(q.explanation || '').trim().slice(0, 500) ||
              `الإجابة الصحيحة هي: ${options[correctIndex]}`,
          };
        })
        .filter((x): x is GeneratedQuizQuestionPayload => Boolean(x))
        .slice(0, 10);

      if (sanitized.length > 0) {
        res.json({
          quizTitle:
            String(parsed.quizTitle || '').trim().slice(0, 180) || `اختبار: ${lessonTitle}`,
          questions: sanitized,
          source: 'ai',
        });
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err || '');
      lastErrDetail = msg.replace(/AIza[0-9A-Za-z_-]{10,}/g, '[REDACTED]').slice(0, 200);
      console.warn(`[AI Quiz Generate - ${modelName}]`, lastErrDetail);
    }
  }

  res.status(502).json({
    error:
      'تعذر توليد الاختبار عبر الذكاء الاصطناعي حالياً. يرجى المحاولة مجدداً أو إنشاء الاختبار يدوياً من تبويب البناء اليدوي.',
  });
}

