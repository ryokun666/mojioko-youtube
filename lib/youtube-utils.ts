/**
 * YouTube URLからビデオIDを抽出する
 */
export const extractVideoId = (url: string): string | null => {
  if (!url || typeof url !== "string") {
    return null;
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

/**
 * 有効なYouTube URLかどうかを検証する
 */
export const isValidYouTubeUrl = (url: string): boolean => {
  if (!url || typeof url !== "string") {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    const validHosts = ["www.youtube.com", "youtube.com", "youtu.be", "m.youtube.com"];

    if (!validHosts.includes(parsedUrl.hostname)) {
      return false;
    }

    return extractVideoId(url) !== null;
  } catch {
    return false;
  }
};
