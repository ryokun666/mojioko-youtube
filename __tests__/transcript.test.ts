import { describe, it, expect } from "vitest";
import { extractVideoId, isValidYouTubeUrl } from "../lib/youtube-utils";

describe("YouTube URL Validation", () => {
  it("should validate standard YouTube URL", () => {
    expect(isValidYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
  });

  it("should validate short YouTube URL", () => {
    expect(isValidYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
  });

  it("should reject invalid URL", () => {
    expect(isValidYouTubeUrl("https://example.com")).toBe(false);
  });

  it("should reject empty string", () => {
    expect(isValidYouTubeUrl("")).toBe(false);
  });

  it("should reject malformed URL", () => {
    expect(isValidYouTubeUrl("not-a-url")).toBe(false);
  });
});

describe("Video ID Extraction", () => {
  it("should extract video ID from standard URL", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("should extract video ID from short URL", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("should extract video ID from URL with additional params", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120")).toBe("dQw4w9WgXcQ");
  });

  it("should return null for invalid URL", () => {
    expect(extractVideoId("https://example.com")).toBeNull();
  });

  it("should extract video ID from embed URL", () => {
    expect(extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
});
