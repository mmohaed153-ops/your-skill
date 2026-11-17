import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import {
  handleGameJamSearch,
  handleGameJamUpdates,
  handleQuizGenerate,
  handleVideoMetadataResolve,
} from './serverRoutes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

interface DiscoverRequestBody {
  query?: string;
  language?: 'all' | 'ar' | 'en';
  level?: 'all' | 'beginner' | 'intermediate' | 'advanced';
  cost?: 'all' | 'free' | 'paid';
}

interface RawDiscoveredLesson {
  title?: unknown;
  url?: unknown;
  duration?: unknown;
}

interface RawDiscoveredCourse {
  title?: unknown;
  description?: unknown;
  platform?: unknown;
  url?: unknown;
  thumbnailUrl?: unknown;
  level?: unknown;
  cost?: unknown;
  language?: unknown;
  duration?: unknown;
  whyRecommended?: unknown;
  lessons?: unknown;
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

function extractYoutubeThumbnail(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    let videoId = '';
    if (host === 'youtu.be') {
      videoId = parsed.pathname.slice(1).split('/')[0] || '';
    } else if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        videoId = parsed.searchParams.get('v') || '';
      } else if (parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.split('/')[2] || '';
      } else if (parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.split('/')[2] || '';
      }
    }
    if (videoId && /^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
      return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }
  } catch {
    // ignore invalid url
  }
  return '';
}

function pickFallbackCover(_queryText: string, _title: string): string {
  return '';
}

function parseJsonArrayFromModelText(rawText: string): RawDiscoveredCourse[] {
  const trimmed = rawText.trim();
  const candidates: string[] = [trimmed];

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    candidates.unshift(fencedMatch[1].trim());
  }

  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    candidates.push(trimmed.slice(firstBracket, lastBracket + 1));
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        return parsed as RawDiscoveredCourse[];
      }
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as { courses?: unknown }).courses)
      ) {
        return (parsed as { courses: RawDiscoveredCourse[] }).courses;
      }
    } catch {
      // try next parse strategy
    }
  }
  return [];
}

function normalizeLevel(value: unknown): 'beginner' | 'intermediate' | 'advanced' | 'all' {
  const s = String(value || '').toLowerCase();
  if (s.includes('begin') || s.includes('مبتد')) return 'beginner';
  if (s.includes('inter') || s.includes('متوسط')) return 'intermediate';
  if (s.includes('adv') || s.includes('متقدم')) return 'advanced';
  return 'all';
}

function normalizeCost(value: unknown): 'free' | 'freemium' | 'paid' {
  const s = String(value || '').toLowerCase();
  if (s.includes('freemium') || s.includes('جزئ')) return 'freemium';
  if (s.includes('paid') || s.includes('مدفوع')) return 'paid';
  return 'free';
}

interface DiscoveredCoursePayload {
  id: string;
  title: string;
  description: string;
  platform: string;
  url: string;
  thumbnailUrl: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'all';
  cost: 'free' | 'freemium' | 'paid';
  language: string;
  duration: string;
  whyRecommended: string;
  lessons: Array<{ title: string; url: string; duration: string }>;
}

const ARABIC_TO_TOPIC_KEYWORDS: Array<[RegExp, string]> = [
  [/(برمج|كود|سوفتوير|ويب|تطبيقات|بايثون|جافا)/, 'programming full course'],
  [/(ألعاب|العاب|جودوت|يونيتي|أنريل|تطوير ألعاب)/, 'game development full course'],
  [/(ثلاثي|ثلاثية|بلندر|نمذجة|3d)/i, '3d modeling blender full course'],
  [/(تصميم|واجهات|جرافيك|فيجما|ui|ux)/i, 'ui ux design full course'],
  [/(إنجليز|انجليز|لغة إنجليزية)/, 'learn english full course'],
  [/(بيانات|ذكاء اصطناعي|تعلم آلي|data|ai)/i, 'data science ai full course'],
  [/(رياضيات|فيزياء|كيمياء|علوم|أحياء)/, 'science math full course'],
  [/(تسويق|أعمال|تجارة|إدارة)/, 'business digital marketing course'],
];

function buildSearchTerms(
  userQuery: string,
  language: 'all' | 'ar' | 'en',
  level: 'all' | 'beginner' | 'intermediate' | 'advanced'
): string[] {
  const hasArabic = /[\u0600-\u06FF]/.test(userQuery);
  const levelHint =
    level === 'beginner'
      ? hasArabic
        ? ' للمبتدئين'
        : ' for beginners'
      : level === 'intermediate'
        ? hasArabic
          ? ' متوسط'
          : ' intermediate'
        : level === 'advanced'
          ? hasArabic
            ? ' متقدم'
            : ' advanced'
          : '';

  const terms: string[] = [];
  if (hasArabic) {
    terms.push(`${userQuery} كورس كامل${levelHint}`.trim());
    if (language !== 'ar') {
      for (const [pattern, englishTopic] of ARABIC_TO_TOPIC_KEYWORDS) {
        if (pattern.test(userQuery)) {
          terms.push(`${englishTopic}${level === 'beginner' ? ' for beginners' : ''}`);
          break;
        }
      }
    }
  } else {
    if (language === 'ar') {
      terms.push(`${userQuery} كورس كامل بالعربي`);
    }
    terms.push(`${userQuery} full course${levelHint}`.trim());
  }

  return Array.from(new Set(terms)).slice(0, 2);
}

function parseYouTubeSearchHtml(
  html: string,
  userQuery: string,
  preferredLang: 'all' | 'ar' | 'en',
  preferredLevel: 'all' | 'beginner' | 'intermediate' | 'advanced'
): DiscoveredCoursePayload[] {
  const match = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/);
  if (!match?.[1]) return [];

  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return [];
  }

  const root = data as {
    contents?: {
      twoColumnSearchResultsRenderer?: {
        primaryContents?: {
          sectionListRenderer?: {
            contents?: Array<{
              itemSectionRenderer?: {
                contents?: Array<Record<string, unknown>>;
              };
            }>;
          };
        };
      };
    };
  };

  const sections =
    root?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
      ?.contents || [];
  const items = sections.flatMap((sec) => sec.itemSectionRenderer?.contents || []);

  const results: DiscoveredCoursePayload[] = [];
  const seenUrls = new Set<string>();

  for (const item of items) {
    if (results.length >= 6) break;

    // 1) Playlist / Course lockupViewModel
    const lockup = item.lockupViewModel as
      | {
          contentId?: string;
          contentType?: string;
          metadata?: {
            lockupMetadataViewModel?: {
              title?: { content?: string };
              metadata?: {
                contentMetadataViewModel?: {
                  metadataRows?: Array<{
                    metadataParts?: Array<{
                      text?: {
                        content?: string;
                        commandRuns?: Array<{
                          onTap?: {
                            innertubeCommand?: {
                              commandMetadata?: {
                                webCommandMetadata?: { url?: string; webPageType?: string };
                              };
                            };
                          };
                        }>;
                      };
                    }>;
                  }>;
                };
              };
            };
          };
          contentImage?: {
            collectionThumbnailViewModel?: {
              primaryThumbnail?: {
                thumbnailViewModel?: {
                  image?: { sources?: Array<{ url?: string }> };
                  overlays?: Array<{
                    thumbnailOverlayBadgeViewModel?: {
                      thumbnailBadges?: Array<{
                        thumbnailBadgeViewModel?: { text?: string };
                      }>;
                    };
                  }>;
                };
              };
            };
          };
          rendererContext?: {
            commandContext?: {
              onTap?: {
                innertubeCommand?: {
                  commandMetadata?: { webCommandMetadata?: { url?: string } };
                };
              };
            };
          };
        }
      | undefined;

    if (lockup?.contentId && lockup.metadata?.lockupMetadataViewModel?.title?.content) {
      const title = lockup.metadata.lockupMetadataViewModel.title.content.trim();
      const playlistId = lockup.contentId.trim();
      const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
      if (!seenUrls.has(playlistUrl)) {
        seenUrls.add(playlistUrl);
        const rows =
          lockup.metadata.lockupMetadataViewModel.metadata?.contentMetadataViewModel
            ?.metadataRows || [];

        let channelName = 'YouTube';
        let description = '';
        const starterLessons: Array<{ title: string; url: string; duration: string }> = [];

        for (const row of rows) {
          for (const part of row.metadataParts || []) {
            const text = (part.text?.content || '').trim();
            if (!text) continue;
            const cmdMeta =
              part.text?.commandRuns?.[0]?.onTap?.innertubeCommand?.commandMetadata
                ?.webCommandMetadata;
            if (cmdMeta?.webPageType === 'WEB_PAGE_TYPE_CHANNEL') {
              if (text !== 'دورة تدريبية' && text !== 'Course' && text !== 'Playlist') {
                channelName = text;
              }
            } else if (cmdMeta?.webPageType === 'WEB_PAGE_TYPE_WATCH' && cmdMeta.url) {
              const splitIdx = text.lastIndexOf('·');
              const lessonTitle =
                splitIdx > 0 ? text.slice(0, splitIdx).trim() : text;
              const lessonDuration =
                splitIdx > 0 ? text.slice(splitIdx + 1).trim() : '';
              const lessonUrl = normalizeHttpUrl(`https://www.youtube.com${cmdMeta.url}`);
              if (lessonTitle && lessonUrl) {
                starterLessons.push({
                  title: lessonTitle.slice(0, 160),
                  url: lessonUrl,
                  duration: lessonDuration.slice(0, 30),
                });
              }
            } else if (
              !text.includes('عرض الدورة') &&
              !text.includes('View full') &&
              text !== 'دورة تدريبية' &&
              text !== 'Course' &&
              text.length > description.length
            ) {
              description = text;
            }
          }
        }

        const thumbSources =
          lockup.contentImage?.collectionThumbnailViewModel?.primaryThumbnail
            ?.thumbnailViewModel?.image?.sources || [];
        const rawThumb = thumbSources[thumbSources.length - 1]?.url || thumbSources[0]?.url || '';
        const badgeText =
          lockup.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel
            ?.overlays?.[0]?.thumbnailOverlayBadgeViewModel?.thumbnailBadges?.[0]
            ?.thumbnailBadgeViewModel?.text || '';

        const isArabicTitle = /[\u0600-\u06FF]/.test(title + description);
        const courseLang =
          preferredLang === 'ar' ? 'العربية' : isArabicTitle ? 'العربية' : 'English';

        results.push({
          id: `yt_pl_${playlistId}`,
          title: title.slice(0, 180),
          description: (
            description ||
            `سلسلة دروس تعليمية متكاملة (${badgeText || 'دورة فيديو'}) من تقديم ${channelName} تغطي موضوع ${userQuery}.`
          ).slice(0, 500),
          platform: `YouTube · ${channelName}`.slice(0, 100),
          url: playlistUrl,
          thumbnailUrl: normalizeHttpUrl(rawThumb) || pickFallbackCover(userQuery, title),
          level: preferredLevel === 'all' ? 'beginner' : preferredLevel,
          cost: 'free',
          language: courseLang,
          duration: badgeText || 'قائمة دروس كاملة',
          whyRecommended: `دورة فيديو متسلسلة مجانية (${badgeText || 'متعددة الدروس'}) مناسبة للتحويل مباشرة إلى مسار تعلم.`,
          lessons:
            starterLessons.length > 0
              ? starterLessons
              : [{ title: `بدء الدورة: ${title}`, url: playlistUrl, duration: badgeText }],
        });
        continue;
      }
    }

    // 2) Full-length course videoRenderer
    const vid = item.videoRenderer as
      | {
          videoId?: string;
          title?: { runs?: Array<{ text?: string }> };
          ownerText?: { runs?: Array<{ text?: string }> };
          lengthText?: { simpleText?: string };
          detailedMetadataSnippets?: Array<{
            snippetText?: { runs?: Array<{ text?: string }> };
          }>;
          thumbnail?: { thumbnails?: Array<{ url?: string }> };
        }
      | undefined;

    if (vid?.videoId && vid.title?.runs?.[0]?.text) {
      const videoUrl = `https://www.youtube.com/watch?v=${vid.videoId}`;
      if (seenUrls.has(videoUrl)) continue;
      seenUrls.add(videoUrl);

      const title = vid.title.runs.map((r) => r.text || '').join('').trim();
      const channelName = vid.ownerText?.runs?.[0]?.text?.trim() || 'YouTube';
      const durationText = vid.lengthText?.simpleText?.trim() || 'دورة فيديو';
      const snippet =
        vid.detailedMetadataSnippets?.[0]?.snippetText?.runs
          ?.map((r) => r.text || '')
          .join('')
          .trim() || '';
      const rawThumb =
        vid.thumbnail?.thumbnails?.[vid.thumbnail.thumbnails.length - 1]?.url ||
        `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`;
      const isArabicTitle = /[\u0600-\u06FF]/.test(title + snippet);

      results.push({
        id: `yt_v_${vid.videoId}`,
        title: title.slice(0, 180),
        description: (
          snippet || `شرح عملي شامل لموضوع ${userQuery} من قناة ${channelName} على يوتيوب.`
        ).slice(0, 500),
        platform: `YouTube · ${channelName}`.slice(0, 100),
        url: videoUrl,
        thumbnailUrl: normalizeHttpUrl(rawThumb) || `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`,
        level: preferredLevel === 'all' ? 'beginner' : preferredLevel,
        cost: 'free',
        language: isArabicTitle ? 'العربية' : 'English',
        duration: durationText,
        whyRecommended: `مصدر عملي متكامل بمدة (${durationText}) من ${channelName} يمكن إضافته فوراً لمسارك.`,
        lessons: [{ title, url: videoUrl, duration: durationText }],
      });
    }
  }

  return results;
}

async function searchLiveWebCourses(
  userQuery: string,
  language: 'all' | 'ar' | 'en',
  level: 'all' | 'beginner' | 'intermediate' | 'advanced'
): Promise<{
  courses: DiscoveredCoursePayload[];
  groundingSources: Array<{ title: string; url: string }>;
  searchQueries: string[];
}> {
  const searchTerms = buildSearchTerms(userQuery, language, level);
  const acceptLang = language === 'en' ? 'en-US,en;q=0.9' : 'ar,en-US;q=0.9,en;q=0.8';
  const collected: DiscoveredCoursePayload[] = [];
  const seenUrls = new Set<string>();

  await Promise.all(
    searchTerms.map(async (term) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 7000);
        const ytRes = await fetch(
          `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}`,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept-Language': acceptLang,
            },
            signal: controller.signal,
          }
        );
        clearTimeout(timer);
        if (ytRes.ok) {
          const html = await ytRes.text();
          for (const course of parseYouTubeSearchHtml(html, userQuery, language, level)) {
            if (!seenUrls.has(course.url)) {
              seenUrls.add(course.url);
              collected.push(course);
            }
          }
        }
      } catch {
        // continue with remaining sources
      }
    })
  );

  // Enrich with structured open learning repositories / curricula from GitHub when relevant
  try {
    const ghQuery = `${searchTerms[0].replace(/كورس كامل/g, '').trim()} course OR tutorial OR roadmap`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const ghRes = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(ghQuery)}&sort=stars&per_page=2`,
      {
        headers: {
          'User-Agent': 'masar-learning-workspace',
          Accept: 'application/vnd.github+json',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
    if (ghRes.ok) {
      const ghData = (await ghRes.json()) as {
        items?: Array<{
          id?: number;
          full_name?: string;
          name?: string;
          description?: string;
          html_url?: string;
          stargazers_count?: number;
          language?: string;
        }>;
      };
      for (const repo of ghData.items || []) {
        const url = normalizeHttpUrl(repo.html_url);
        if (!url || seenUrls.has(url) || collected.length >= 8) continue;
        seenUrls.add(url);
        const title = String(repo.full_name || repo.name || '').trim();
        collected.push({
          id: `gh_${repo.id || collected.length}`,
          title: `${title} — منهج ومصادر مفتوحة`,
          description: String(
            repo.description || `دليل ومناهج تعليمية مفتوحة المصدر لتعلم ${userQuery}.`
          ).slice(0, 500),
          platform: 'GitHub Open Curriculum',
          url,
          thumbnailUrl: pickFallbackCover(userQuery, title),
          level: level === 'all' ? 'all' : level,
          cost: 'free',
          language: /[\u0600-\u06FF]/.test(String(repo.description || ''))
            ? 'العربية'
            : 'English',
          duration: `${(repo.stargazers_count || 0).toLocaleString()} ★`,
          whyRecommended: 'منهج مفتوح المصدر عالي التقييم يحتوي على تمارين ومراجع منظمة.',
          lessons: [{ title: `استكشاف المنهج: ${title}`, url, duration: 'دليل تفاعلي' }],
        });
      }
    }
  } catch {
    // optional source
  }

  const groundingSources = collected.slice(0, 6).map((c) => ({
    title: `${c.title} (${c.platform})`,
    url: c.url,
  }));

  return {
    courses: collected.slice(0, 6),
    groundingSources,
    searchQueries: searchTerms,
  };
}

async function handleCourseDiscovery(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as DiscoverRequestBody;
  const userQuery = typeof body.query === 'string' ? body.query.trim() : '';

  if (userQuery.length < 2 || userQuery.length > 300) {
    res.status(400).json({
      error: 'يرجى كتابة موضوع التعلم (حرفين على الأقل) للبحث عن الدورات المناسبة.',
    });
    return;
  }

  const langPref = body.language || 'all';
  const levelPref = body.level || 'all';
  const costPref = body.cost || 'all';
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  // Start live web search in parallel so results are rich and resilient
  const liveSearchPromise = searchLiveWebCourses(userQuery, langPref, levelPref);

  if (apiKey) {
    const filterHints = [
      langPref === 'ar'
        ? 'Prefer Arabic courses or courses with Arabic instruction.'
        : langPref === 'en'
          ? 'Prefer English courses.'
          : 'Include top Arabic and English courses as appropriate for the query.',
      levelPref !== 'all' ? `Target skill level: ${levelPref}.` : 'Include suitable levels.',
      costPref === 'free'
        ? 'Focus on free courses and open playlists.'
        : costPref === 'paid'
          ? 'Include top structured paid or certificate courses.'
          : 'Include a helpful mix of free and structured courses.',
    ].join(' ');

    const systemInstruction = `You are a course research assistant for a learning workspace.
Use Google Search to find real, active, high-quality online courses, video playlists, and learning resources matching the user's learning goal across any topic (programming, game development, 3D modeling, design, languages, science, math, business, etc.).
Return ONLY a valid JSON array (no markdown commentary outside JSON) of 6 real courses with exact fields:
[
  {
    "title": "Course title",
    "description": "Clear 1-2 sentence summary in the same language as the user query (Arabic if user wrote in Arabic, English if in English)",
    "platform": "Platform or creator name (e.g. YouTube - Elzero Web School, freeCodeCamp, Coursera, edX, Udacity, Udemy, Khan Academy, Godot Docs)",
    "url": "Direct https URL to the course or playlist from search results",
    "thumbnailUrl": "Direct image URL if found or empty string",
    "level": "beginner | intermediate | advanced | all",
    "cost": "free | freemium | paid",
    "language": "العربية or English",
    "duration": "Estimated duration e.g. 12 ساعة or 6 weeks",
    "whyRecommended": "1 short sentence explaining why this course is a strong choice for the user",
    "lessons": [
      { "title": "Starter lesson or module 1 title", "url": "https URL to video or module", "duration": "optional" }
    ]
  }
]
Provide 3 to 5 starter lessons/modules per course using real URLs or section links related to that course so the learner can immediately turn the course into a Learning Path.`;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const candidateModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: `User learning goal: "${userQuery}".\nPreferences: ${filterHints}\nSearch for real courses and return the JSON array.`,
          config: {
            systemInstruction,
            tools: [{ googleSearch: {} }],
          },
        });

        const rawText = response.text || '';
        const parsedCourses = parseJsonArrayFromModelText(rawText);

        const groundingChunks =
          response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const groundingSources = groundingChunks
          .map((chunk) => ({
            title: chunk.web?.title || '',
            url: normalizeHttpUrl(chunk.web?.uri),
          }))
          .filter((item) => Boolean(item.url));

        const searchQueries =
          response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];

        const courses = parsedCourses
          .map((item, index): DiscoveredCoursePayload | null => {
            const title = String(item.title || '').trim().slice(0, 180);
            const rawUrl = normalizeHttpUrl(item.url);
            const fallbackSourceUrl = groundingSources[index]?.url || '';
            const url = rawUrl || fallbackSourceUrl;
            if (!title || !url) return null;

            const rawThumb = normalizeHttpUrl(item.thumbnailUrl);
            const ytThumb = extractYoutubeThumbnail(url);
            const thumbnailUrl = rawThumb || ytThumb || pickFallbackCover(userQuery, title);

            const lessonsRaw = Array.isArray(item.lessons)
              ? (item.lessons as RawDiscoveredLesson[])
              : [];
            const lessons = lessonsRaw
              .map((lesson) => {
                const lessonTitle = String(lesson.title || '').trim().slice(0, 180);
                const lessonUrl = normalizeHttpUrl(lesson.url) || url;
                const lessonDuration = String(lesson.duration || '').trim().slice(0, 40);
                if (!lessonTitle) return null;
                return {
                  title: lessonTitle,
                  url: lessonUrl,
                  duration: lessonDuration,
                };
              })
              .filter((l): l is { title: string; url: string; duration: string } => Boolean(l))
              .slice(0, 8);

            return {
              id: `disc_${Date.now()}_${index}`,
              title,
              description: String(item.description || '').trim().slice(0, 600),
              platform: String(item.platform || 'منصة تعليمية').trim().slice(0, 100),
              url,
              thumbnailUrl,
              level: normalizeLevel(item.level),
              cost: normalizeCost(item.cost),
              language: String(item.language || 'عربي / إنجليزي').trim().slice(0, 60),
              duration: String(item.duration || 'مسار مرن').trim().slice(0, 60),
              whyRecommended: String(item.whyRecommended || '').trim().slice(0, 260),
              lessons:
                lessons.length > 0
                  ? lessons
                  : [
                      {
                        title: `الدرس التمهيدي: ${title}`,
                        url,
                        duration: '',
                      },
                    ],
            };
          })
          .filter((c): c is DiscoveredCoursePayload => Boolean(c))
          .slice(0, 8);

        if (courses.length > 0) {
          res.json({
            summary: `تم العثور على ${courses.length} دورات موثوقة ومرتبطة بهدفك "${userQuery}" عبر البحث الذكي المدعوم بالويب.`,
            courses,
            groundingSources,
            searchQueries,
          });
          return;
        }
      } catch (err) {
        const rawDetail = err instanceof Error ? err.message : String(err || 'Unknown Gemini API error');
        const safeDetail = rawDetail.replace(/AIza[0-9A-Za-z_-]{10,}/g, '[REDACTED]');
        console.warn(`[AI Course Finder - ${modelName}]`, safeDetail.slice(0, 240));
      }
    }
  }

  // Fallback to real multi-source live course search when Gemini quota is limited or unavailable
  const liveResults = await liveSearchPromise;
  if (liveResults.courses.length > 0) {
    res.json({
      summary: `تم جلب ${liveResults.courses.length} دورات حقيقية مباشرة من محرك بحث الكورسات حول "${userQuery}" — يمكنك حفظ أي منها في كورساتي أو تحويله لمسار تعلم فوراً.`,
      courses: liveResults.courses,
      groundingSources: liveResults.groundingSources,
      searchQueries: liveResults.searchQueries,
    });
    return;
  }

  res.status(502).json({
    error: 'لم يعثر محرك البحث على نتائج كافية لهذا الموضوع حالياً. جرّب صياغة أخرى أو كلمات مفتاحية أوضح.',
  });
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'masar-learning-workspace' });
  });

  app.post('/api/courses/discover', (req: Request, res: Response) => {
    void handleCourseDiscovery(req, res);
  });

  app.post('/api/game-jams/search', (req: Request, res: Response) => {
    void handleGameJamSearch(req, res);
  });

  app.get('/api/game-jams/updates', (req: Request, res: Response) => {
    void handleGameJamUpdates(req, res);
  });

  app.post('/api/videos/resolve', (req: Request, res: Response) => {
    void handleVideoMetadataResolve(req, res);
  });

  app.post('/api/quizzes/generate', (req: Request, res: Response) => {
    void handleQuizGenerate(req, res);
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      appType: 'spa',
    });

    app.get('/@vite/client', (_req: Request, res: Response) => {
      res.type('application/javascript');
      res.setHeader('Cache-Control', 'no-store');
      res.send(`import "/node_modules/vite/dist/client/env.mjs";

const sheetsMap = new Map();
const linkSheetsMap = new Map();
let lastInsertedStyle;

if (typeof document !== "undefined") {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    const id = el.getAttribute("data-vite-dev-id");
    if (id) sheetsMap.set(id, el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    const id = el.getAttribute("data-vite-dev-id");
    if (id) linkSheetsMap.set(id, el);
  });
}

export function updateStyle(id, content) {
  if (typeof document === "undefined" || linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => {
        lastInsertedStyle = undefined;
      }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}

export function removeStyle(id) {
  if (typeof document === "undefined") return;
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]').forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}

export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}

export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return pathname + "?" + queryToInject + (search ? "&" + search.slice(1) : "") + (hash || "");
}

export class ErrorOverlay {
  constructor() {}
}
`);
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
