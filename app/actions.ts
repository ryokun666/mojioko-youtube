"use server";

import { Innertube } from "youtubei.js";
import { extractVideoId, isValidYouTubeUrl } from "@/lib/youtube-utils";

export interface VideoMetadata {
  title: string;
  channelName: string;
  description: string;
  thumbnail: string;
}

export interface TranscriptResult {
  success: boolean;
  transcript?: string;
  language?: string;
  metadata?: VideoMetadata;
  error?: string;
}

// youtubei.js のキャプショントラックの型
interface CaptionTrack {
  base_url: string;
  name: { text: string; rtl: boolean };
  vss_id: string;
  language_code: string;
  kind?: string;
  is_translatable: boolean;
}

// Innertubeインスタンスをキャッシュ
let innertubeInstance: Innertube | null = null;

async function getInnertube(): Promise<Innertube> {
  if (!innertubeInstance) {
    innertubeInstance = await Innertube.create({
      generate_session_locally: true,
    });
  }
  return innertubeInstance;
}

// 字幕イベントの型
interface TranscriptEvent {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: Array<{ utf8?: string; acAsrConf?: number }>;
}

// 字幕URLからテキストを取得（タイムスタンプ情報も含む）
async function fetchTranscriptFromUrl(
  url: string
): Promise<Array<{ text: string; startMs: number; durationMs: number }>> {
  // JSON形式で取得（fmt=json3）
  const jsonUrl = url + "&fmt=json3";
  const response = await fetch(jsonUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch transcript: ${response.status}`);
  }

  const data = await response.json();

  if (!data.events) {
    throw new Error("No transcript events found");
  }

  // イベントからテキストとタイムスタンプを抽出
  const segments: Array<{
    text: string;
    startMs: number;
    durationMs: number;
  }> = [];

  for (const event of data.events as TranscriptEvent[]) {
    if (event.segs && event.tStartMs !== undefined) {
      const text = event.segs
        .map((seg) => seg.utf8?.trim() || "")
        .filter((t) => t !== "")
        .join("");

      if (text) {
        segments.push({
          text,
          startMs: event.tStartMs,
          durationMs: event.dDurationMs || 0,
        });
      }
    }
  }

  return segments;
}

// テキストを読みやすく整形（改行を追加）
function formatTranscript(
  segments: Array<{ text: string; startMs: number; durationMs: number }>
): string {
  if (segments.length === 0) return "";

  const lines: string[] = [];
  let currentLine = "";
  let lastEndMs = 0;
  const LINE_BREAK_INTERVAL_MS = 5000; // 5秒間隔で改行

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const text = segment.text;

    // 句読点の後に改行を入れる（日本語の場合）
    if (/[。！？]/.test(text)) {
      currentLine += text;
      lines.push(currentLine.trim());
      currentLine = "";
      lastEndMs = segment.startMs + segment.durationMs;
      continue;
    }

    // 時間間隔が大きい場合（5秒以上）は改行
    if (lastEndMs > 0 && segment.startMs - lastEndMs > LINE_BREAK_INTERVAL_MS) {
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
        currentLine = "";
      }
    }

    // テキストを追加
    if (currentLine) {
      currentLine += " " + text;
    } else {
      currentLine = text;
    }

    lastEndMs = segment.startMs + segment.durationMs;
  }

  // 最後の行を追加
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines.join("\n\n");
}

// 言語名を日本語に変換
function translateLanguageName(languageName: string): string {
  // 自動生成のマーカーを日本語に変換
  let translated = languageName
    .replace(/\s*\(auto-generated\)/gi, "（自動生成）")
    .replace(/\s*\(自動生成\)/gi, "（自動生成）");

  // 主要な言語名の英語→日本語変換マップ
  const languageMap: Record<string, string> = {
    Japanese: "日本語",
    English: "英語",
    Chinese: "中国語",
    Korean: "韓国語",
    Spanish: "スペイン語",
    French: "フランス語",
    German: "ドイツ語",
    Italian: "イタリア語",
    Portuguese: "ポルトガル語",
    Russian: "ロシア語",
    Arabic: "アラビア語",
    Hindi: "ヒンディー語",
    Thai: "タイ語",
    Vietnamese: "ベトナム語",
    Indonesian: "インドネシア語",
    Dutch: "オランダ語",
    Polish: "ポーランド語",
    Turkish: "トルコ語",
    Swedish: "スウェーデン語",
    Norwegian: "ノルウェー語",
    Danish: "デンマーク語",
    Finnish: "フィンランド語",
    Greek: "ギリシャ語",
    Hebrew: "ヘブライ語",
    Czech: "チェコ語",
    Romanian: "ルーマニア語",
    Hungarian: "ハンガリー語",
    Ukrainian: "ウクライナ語",
    Malay: "マレー語",
    Filipino: "フィリピン語",
    Bengali: "ベンガル語",
    Tamil: "タミル語",
    Telugu: "テルグ語",
    Marathi: "マラーティー語",
    Gujarati: "グジャラート語",
    Kannada: "カンナダ語",
    Punjabi: "パンジャブ語",
    Urdu: "ウルドゥー語",
  };

  // 言語名を変換
  for (const [en, ja] of Object.entries(languageMap)) {
    // 完全一致の場合
    if (translated === en || translated.startsWith(en + " ")) {
      translated = translated.replace(en, ja);
      break;
    }
    // 部分一致の場合（例: "Japanese (auto-generated)"）
    if (translated.includes(en)) {
      translated = translated.replace(en, ja);
      break;
    }
  }

  return translated;
}

// 言語優先順位（手動字幕 > 自動生成字幕）
function selectBestCaptionTrack(
  tracks: CaptionTrack[],
  preferredLangs: string[]
): CaptionTrack | null {
  // 各言語に対して、まず手動字幕を探し、なければ自動生成字幕を探す
  for (const lang of preferredLangs) {
    // 手動字幕を探す（vss_idが "." で始まる）
    const manualTrack = tracks.find(
      (t) => t.language_code === lang && t.vss_id.startsWith(".")
    );
    if (manualTrack) return manualTrack;

    // 自動生成字幕を探す（vss_idが "a." で始まる、または kind が "asr"）
    const autoTrack = tracks.find(
      (t) =>
        t.language_code === lang &&
        (t.vss_id.startsWith("a.") || t.kind === "asr")
    );
    if (autoTrack) return autoTrack;
  }

  // 見つからなければ最初のトラックを返す
  return tracks[0] || null;
}

export async function getTranscript(url: string): Promise<TranscriptResult> {
  if (!url || !url.trim()) {
    return {
      success: false,
      error: "URLを入力してください",
    };
  }

  if (!isValidYouTubeUrl(url)) {
    return {
      success: false,
      error: "有効なYouTube URLを入力してください",
    };
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return {
      success: false,
      error: "動画IDを取得できませんでした",
    };
  }

  try {
    const yt = await getInnertube();
    const info = await yt.getBasicInfo(videoId);

    // メタデータを取得
    const basicInfo = info.basic_info;
    const metadata: VideoMetadata = {
      title: basicInfo.title || "タイトル不明",
      channelName: basicInfo.channel?.name || basicInfo.author || "チャンネル不明",
      description: basicInfo.short_description || "",
      thumbnail:
        basicInfo.thumbnail?.[0]?.url ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };

    // 字幕トラックを取得
    const captions = info.captions;

    if (
      !captions ||
      !captions.caption_tracks ||
      captions.caption_tracks.length === 0
    ) {
      return {
        success: false,
        error: "この動画には字幕がありません",
        metadata,
      };
    }

    const captionTracks = captions.caption_tracks as unknown as CaptionTrack[];

    // 日本語 → 英語 → その他の順で字幕を選択
    const preferredLanguages = ["ja", "en"];
    const selectedTrack = selectBestCaptionTrack(
      captionTracks,
      preferredLanguages
    );

    if (!selectedTrack || !selectedTrack.base_url) {
      return {
        success: false,
        error: "この動画には字幕がありません",
        metadata,
      };
    }

    // 字幕URLからテキストを取得（タイムスタンプ情報も含む）
    const segments = await fetchTranscriptFromUrl(selectedTrack.base_url);

    if (segments.length === 0) {
      return {
        success: false,
        error: "字幕テキストの抽出に失敗しました",
        metadata,
      };
    }

    // テキストを読みやすく整形（改行を追加）
    const fullTranscript = formatTranscript(segments);

    // 言語名を日本語に変換
    const language = translateLanguageName(selectedTrack.name.text);

    return {
      success: true,
      transcript: fullTranscript,
      language,
      metadata,
    };
  } catch (error) {
    console.error("Transcript fetch error:", error);

    if (error instanceof Error) {
      // 字幕が無効な場合
      if (
        error.message.includes("Transcript") ||
        error.message.includes("transcript") ||
        error.message.includes("caption")
      ) {
        return {
          success: false,
          error:
            "この動画には字幕がありません。字幕が有効な動画を試してください。",
        };
      }
      // 動画が利用不可
      if (
        error.message.includes("unavailable") ||
        error.message.includes("Video")
      ) {
        return {
          success: false,
          error: "この動画は利用できません",
        };
      }
    }

    return {
      success: false,
      error:
        "字幕の取得中にエラーが発生しました。しばらくしてからお試しください。",
    };
  }
}
