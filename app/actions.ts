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
let initializationPromise: Promise<Innertube> | null = null;

async function getInnertube(): Promise<Innertube> {
  // 既にインスタンスがある場合はそれを返す
  if (innertubeInstance) {
    return innertubeInstance;
  }

  // 初期化中の場合は、そのPromiseを返す（重複初期化を防ぐ）
  if (initializationPromise) {
    return initializationPromise;
  }

  // 初期化を開始
  initializationPromise = (async () => {
    try {
      console.log("[Innertube] Initializing...");
      // Vercel環境を検出
      const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV;
      console.log(`[Innertube] Environment: ${isVercel ? "Vercel" : "Local"}`);

      const instance = await Innertube.create({
        // Vercel環境では generate_session_locally を false にしてみる
        generate_session_locally: !isVercel,
        // Vercel環境での互換性を向上
        retrieve_player: true,
        // Vercelのサーバーレス環境は読み取り専用ファイルシステムのため、キャッシュを無効化
        enable_session_cache: false,
      });
      console.log("[Innertube] Initialized successfully");
      innertubeInstance = instance;
      return instance;
    } catch (error) {
      console.error("[Innertube] Initialization failed:", error);

      // ファイルシステムエラー（読み取り専用）の検出
      if (error instanceof Error) {
        if (
          error.message.includes("EROFS") ||
          error.message.includes("read-only") ||
          error.message.includes("EACCES") ||
          error.message.includes("ENOENT")
        ) {
          console.error(
            "[Innertube] File system error detected. This might be a Vercel read-only filesystem issue."
          );
        }
        // 403エラー（IPブロック）の検出
        if (
          error.message.includes("403") ||
          error.message.includes("Forbidden") ||
          error.message.includes("Sign in to confirm")
        ) {
          console.error(
            "[Innertube] 403 Forbidden detected. This might be YouTube IP blocking."
          );
        }
      }

      // エラーが発生した場合は、次回再試行できるようにクリア
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
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
  console.log(
    `[fetchTranscriptFromUrl] Fetching from: ${jsonUrl.substring(0, 100)}...`
  );

  const response = await fetch(jsonUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    console.error(
      `[fetchTranscriptFromUrl] Failed: ${response.status} ${response.statusText}`
    );
    throw new Error(
      `Failed to fetch transcript: ${response.status} ${response.statusText}`
    );
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

  // リトライロジック（最大2回まで）
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // リトライ時はインスタンスを再初期化
      if (attempt > 0) {
        innertubeInstance = null;
        initializationPromise = null;
        // 少し待ってから再試行
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }

      const yt = await getInnertube();
      console.log(`[getTranscript] Fetching info for video: ${videoId}`);

      // ローカルでは getBasicInfo が動作するため、まず getBasicInfo を試す
      // Vercel環境では getInfo の captions プロパティにアクセスできない問題がある
      let info;
      let useGetInfo = false;
      try {
        info = await yt.getBasicInfo(videoId);
        console.log(
          `[getTranscript] Info fetched with getBasicInfo successfully`
        );
      } catch (error) {
        console.log(
          `[getTranscript] getBasicInfo failed, trying getInfo:`,
          error
        );
        // getBasicInfo が失敗した場合は getInfo を試す
        info = await yt.getInfo(videoId);
        useGetInfo = true;
        console.log(`[getTranscript] Info fetched with getInfo successfully`);
      }

      // メタデータを取得
      // getInfo と getBasicInfo で構造が異なる可能性があるため、両方に対応
      const basicInfo = info.basic_info || info;
      const metadata: VideoMetadata = {
        title: basicInfo.title || "タイトル不明",
        channelName:
          basicInfo.channel?.name || basicInfo.author || "チャンネル不明",
        description: basicInfo.short_description || "",
        thumbnail:
          basicInfo.thumbnail?.[0]?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      };

      // 字幕トラックを取得
      let captions = info.captions;

      // デバッグ: captions の詳細を確認
      console.log(`[getTranscript] Captions check:`, {
        captionsExists: !!captions,
        captionsType: typeof captions,
        captionsValue: captions,
        infoKeys: Object.keys(info),
        hasBasicInfo: !!info.basic_info,
      });

      // Vercel環境では、getBasicInfo でも captions が null になる問題がある
      // infoオブジェクトの全構造をログに出力して確認
      if (!captions) {
        console.log(
          `[getTranscript] Captions is null, checking info structure`
        );
        if (info.basic_info) {
          console.log(
            `[getTranscript] basic_info keys:`,
            Object.keys(info.basic_info)
          );
        }
        // infoオブジェクト全体をJSON化して確認（循環参照を避けるため、一部のみ）
        try {
          const infoSnapshot = {
            hasCaptions: "captions" in info,
            captionsType: typeof (info as unknown as { captions?: unknown })
              .captions,
            basicInfoKeys: info.basic_info ? Object.keys(info.basic_info) : [],
          };
          console.log(
            `[getTranscript] Info snapshot:`,
            JSON.stringify(infoSnapshot, null, 2)
          );
        } catch (e) {
          console.log(`[getTranscript] Failed to serialize info:`, e);
        }
      }

      // getInfo を使用した場合、captions プロパティに直接アクセスできない可能性がある
      // Object.keys には 'captions' が含まれているが、info.captions が undefined になる問題
      if (!captions && useGetInfo) {
        console.log(
          `[getTranscript] Captions not accessible via info.captions, trying alternative access methods`
        );

        // プロキシやゲッター経由でアクセスできない場合、別の方法を試す
        const infoAny = info as unknown as Record<string, unknown>;

        // 1. ブラケット記法でアクセス
        if (infoAny["captions"]) {
          captions = infoAny["captions"] as typeof info.captions;
          console.log(`[getTranscript] Captions found via bracket notation`);
        }

        // 2. Reflect.get でアクセス
        if (!captions && typeof Reflect !== "undefined") {
          const captionsValue = Reflect.get(info, "captions");
          if (captionsValue) {
            captions = captionsValue as typeof info.captions;
            console.log(`[getTranscript] Captions found via Reflect.get`);
          }
        }

        // 3. Object.getOwnPropertyDescriptor で確認
        if (!captions) {
          const descriptor = Object.getOwnPropertyDescriptor(info, "captions");
          if (descriptor && descriptor.get) {
            try {
              captions = descriptor.get.call(info) as typeof info.captions;
              console.log(
                `[getTranscript] Captions found via property descriptor getter`
              );
            } catch (e) {
              console.log(
                `[getTranscript] Failed to get captions via descriptor:`,
                e
              );
            }
          }
        }

        // それでも取得できない場合は、getBasicInfo を再試行
        if (!captions) {
          console.log(
            `[getTranscript] All access methods failed, retrying getBasicInfo`
          );
          try {
            const basicInfo = await yt.getBasicInfo(videoId);
            captions = basicInfo.captions;
            console.log(
              `[getTranscript] Captions from getBasicInfo retry:`,
              captions ? "exists" : "null"
            );
          } catch (fallbackError) {
            console.log(
              `[getTranscript] getBasicInfo retry failed:`,
              fallbackError
            );
          }
        }
      }

      console.log(
        `[getTranscript] Captions object:`,
        captions ? "exists" : "null"
      );

      if (captions) {
        console.log(`[getTranscript] Captions structure:`, {
          hasCaptionTracks: !!captions.caption_tracks,
          captionTracksLength: captions.caption_tracks?.length || 0,
        });
      }

      if (
        !captions ||
        !captions.caption_tracks ||
        !Array.isArray(captions.caption_tracks) ||
        captions.caption_tracks.length === 0
      ) {
        console.log(`[getTranscript] No caption tracks found`);
        return {
          success: false,
          error: "この動画には字幕がありません",
          metadata,
        };
      }

      const captionTracks =
        captions.caption_tracks as unknown as CaptionTrack[];
      console.log(
        `[getTranscript] Found ${captionTracks.length} caption tracks`
      );

      // 日本語 → 英語 → その他の順で字幕を選択
      const preferredLanguages = ["ja", "en"];
      const selectedTrack = selectBestCaptionTrack(
        captionTracks,
        preferredLanguages
      );
      console.log(
        `[getTranscript] Selected track:`,
        selectedTrack
          ? {
              language: selectedTrack.language_code,
              name: selectedTrack.name.text,
              hasBaseUrl: !!selectedTrack.base_url,
            }
          : "null"
      );

      if (!selectedTrack || !selectedTrack.base_url) {
        console.log(
          `[getTranscript] No valid track selected or missing base_url`
        );
        return {
          success: false,
          error: "この動画には字幕がありません",
          metadata,
        };
      }

      // 字幕URLからテキストを取得（タイムスタンプ情報も含む）
      console.log(`[getTranscript] Fetching transcript from URL`);
      const segments = await fetchTranscriptFromUrl(selectedTrack.base_url);
      console.log(
        `[getTranscript] Transcript fetched: ${segments.length} segments`
      );

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
      console.error(
        `Transcript fetch error (attempt ${attempt + 1}/${maxRetries + 1}):`,
        error
      );
      lastError = error instanceof Error ? error : new Error(String(error));

      // 最後の試行でない場合、リトライ
      if (attempt < maxRetries) {
        continue;
      }
    }
  }

  // すべてのリトライが失敗した場合
  const error = lastError || new Error("Unknown error");
  console.error("Transcript fetch error (all retries failed):", error);

  if (error instanceof Error) {
    // ファイルシステムエラー（Vercelの読み取り専用ファイルシステム）
    if (
      error.message.includes("EROFS") ||
      error.message.includes("read-only") ||
      error.message.includes("EACCES") ||
      error.message.includes("ENOENT")
    ) {
      return {
        success: false,
        error:
          "ファイルシステムエラーが発生しました。キャッシュ設定を確認してください。",
      };
    }
    // 403エラー（YouTubeによるIPブロック）
    if (
      error.message.includes("403") ||
      error.message.includes("Forbidden") ||
      error.message.includes("Sign in to confirm") ||
      error.message.includes("bot")
    ) {
      return {
        success: false,
        error:
          "YouTubeによるアクセス制限が発生しました。しばらくしてからお試しください。",
      };
    }
    // タイムアウトエラー
    if (
      error.message.includes("timeout") ||
      error.message.includes("Timeout") ||
      error.message.includes("TIMEOUT") ||
      error.name === "TimeoutError"
    ) {
      return {
        success: false,
        error:
          "タイムアウトが発生しました。動画が長い場合、時間がかかることがあります。しばらくしてからお試しください。",
      };
    }
    // ネットワークエラー
    if (
      error.message.includes("fetch") ||
      error.message.includes("network") ||
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("ENOTFOUND")
    ) {
      return {
        success: false,
        error:
          "ネットワークエラーが発生しました。インターネット接続を確認してください。",
      };
    }
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
      error.message.includes("Video") ||
      error.message.includes("not found")
    ) {
      return {
        success: false,
        error: "この動画は利用できません",
      };
    }
    // その他のエラー（詳細を返す）
    return {
      success: false,
      error: `エラーが発生しました: ${error.message}`,
    };
  }

  return {
    success: false,
    error:
      "字幕の取得中にエラーが発生しました。しばらくしてからお試しください。",
  };
}
