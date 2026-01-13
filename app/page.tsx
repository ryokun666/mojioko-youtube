"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { getTranscript, VideoMetadata } from "./actions";
import LordIcon from "@/components/LordIcon";

export default function Home() {
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [language, setLanguage] = useState("");
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedAi, setCopiedAi] = useState(false);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setTranscript("");
    setLanguage("");
    setMetadata(null);
    setIsDescriptionOpen(false);

    startTransition(async () => {
      const result = await getTranscript(url);

      if (result.metadata) {
        setMetadata(result.metadata);
      }

      if (result.success && result.transcript) {
        setTranscript(result.transcript);
        setLanguage(result.language || "");
      } else {
        setError(result.error || "エラーが発生しました");
      }
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("コピーに失敗しました");
    }
  };

  const handleAiCopy = async () => {
    if (!metadata) return;

    const aiPrompt = `以下のYouTube動画の情報を元に、要約を作成してください。

■タイトル
${metadata.title}

■概要
${metadata.description || "（概要なし）"}

■文字起こし
${transcript}`;

    try {
      await navigator.clipboard.writeText(aiPrompt);
      setCopiedAi(true);
      setTimeout(() => setCopiedAi(false), 2000);
    } catch {
      setError("コピーに失敗しました");
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a]">
      <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        {/* Header */}
        <header className="mb-12 text-center animate-fade-in">
          <div className="mb-4 flex items-center justify-center gap-3">
            <LordIcon
              src="https://cdn.lordicon.com/wloilxuq.json"
              trigger="loop"
              delay="2000"
              colors="primary:#171717,secondary:#737373"
              size={48}
            />
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-4xl">
              モジオコYouTube
            </h1>
          </div>
          <p className="text-base text-zinc-500 dark:text-zinc-400">
            YouTube動画のURLを入力して、字幕テキストを取得
          </p>
        </header>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="mb-8 animate-slide-up">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 text-base text-zinc-900 placeholder-zinc-400 shadow-sm transition-all focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-800"
              />
            </div>
            <button
              type="submit"
              disabled={isPending || !url.trim()}
              className="group flex h-14 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-8 text-base font-medium text-white shadow-sm transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer"
            >
              {isPending ? (
                <>
                  <LordIcon
                    src="https://cdn.lordicon.com/lqxfrxad.json"
                    trigger="loop"
                    colors="primary:#ffffff"
                    size={24}
                  />
                  <span>取得中...</span>
                </>
              ) : (
                <>
                  <LordIcon
                    src="https://cdn.lordicon.com/ternnbni.json"
                    trigger="hover"
                    target=".group"
                    colors="primary:#ffffff"
                    size={24}
                  />
                  <span>取得する</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Error Message */}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-700 animate-fade-in dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
            <LordIcon
              src="https://cdn.lordicon.com/usownftb.json"
              trigger="in"
              colors="primary:#dc2626"
              size={24}
            />
            <span>{error}</span>
          </div>
        )}

        {/* Video Metadata */}
        {metadata && (
          <div className="mb-8 animate-slide-up">
            {/* Thumbnail & Title */}
            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              {/* Thumbnail */}
              <div className="relative aspect-video w-full bg-zinc-100 dark:bg-zinc-800">
                <Image
                  src={metadata.thumbnail}
                  alt={metadata.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>

              {/* Title & Channel */}
              <div className="p-5">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 leading-relaxed">
                  {metadata.title}
                </h2>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {metadata.channelName}
                </p>
              </div>

              {/* Description Accordion */}
              {metadata.description && (
                <div className="border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer"
                  >
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      概要欄
                    </span>
                    <svg
                      className={`h-5 w-5 text-zinc-400 transition-transform ${
                        isDescriptionOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {isDescriptionOpen && (
                    <div className="px-5 pb-5">
                      <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                        {metadata.description}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transcript Result */}
        {transcript && (
          <div className="animate-slide-up">
            {/* Header with Copy Buttons */}
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  文字起こし
                </h2>
                {language && (
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {language}
                  </span>
                )}
              </div>

              {/* Copy Buttons */}
              <div className="flex items-center gap-2">
                {/* AI Copy Button */}
                <button
                  onClick={handleAiCopy}
                  className="group flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 transition-all hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-700 cursor-pointer"
                >
                  {copiedAi ? (
                    <>
                      <LordIcon
                        src="https://cdn.lordicon.com/oqdmuxru.json"
                        trigger="in"
                        colors="primary:#16a34a"
                        size={18}
                      />
                      <span className="text-green-600 dark:text-green-400">
                        コピー完了
                      </span>
                    </>
                  ) : (
                    <>
                      <LordIcon
                        src="https://cdn.lordicon.com/wzrwaorf.json"
                        trigger="hover"
                        colors="primary:#737373"
                        size={18}
                      />
                      <span>AI要約用</span>
                    </>
                  )}
                </button>

                {/* Normal Copy Button */}
                <button
                  onClick={handleCopy}
                  className="group flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-all hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <LordIcon
                        src="https://cdn.lordicon.com/oqdmuxru.json"
                        trigger="in"
                        colors="primary:#16a34a"
                        size={20}
                      />
                      <span className="text-green-600 dark:text-green-400">
                        コピーしました
                      </span>
                    </>
                  ) : (
                    <>
                      <LordIcon
                        src="https://cdn.lordicon.com/iykgtsbt.json"
                        trigger="hover"
                        target=".group"
                        colors="primary:#737373"
                        size={20}
                      />
                      <span>コピー</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Transcript Content */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="whitespace-pre-wrap text-base leading-8 text-zinc-700 dark:text-zinc-300">
                {transcript}
              </p>
            </div>
            <p className="mt-3 text-right text-sm text-zinc-400 dark:text-zinc-500">
              {transcript.length.toLocaleString()} 文字
            </p>
          </div>
        )}

        {/* Empty State */}
        {!transcript && !error && !isPending && !metadata && (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
            <LordIcon
              src="https://cdn.lordicon.com/depeqmsz.json"
              trigger="loop"
              delay="3000"
              colors="primary:#a1a1aa,secondary:#d4d4d8"
              size={80}
            />
            <p className="mt-4 text-zinc-400 dark:text-zinc-500">
              YouTube URLを入力して字幕を取得してください
            </p>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 border-t border-zinc-200 pt-6 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            字幕が含まれているYouTube動画のみ対応しています
          </p>
        </footer>
      </div>
    </div>
  );
}
