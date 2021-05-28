import fs from "fs";
import fetch from "node-fetch";

const baseURL = "https://www.youtube.com/live_chat?is_popout=1&v=";

interface Emoji {
  emojiId: string;
  shortcuts: string[];
  searchTerms: string[];
  image: {
    thumbnails: {
      url: string;
      width: number;
      height: number;
    }[];
    accessibility: { accessibilityData: { label: string } };
  };
  isCustomEmoji: true;
  isLocked: true;
}

interface YtInitialData {
  contents: {
    liveChatRenderer: {
      emojis: Emoji[];
    };
  };
}

const headers: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "max-age=0",
  "sec-ch-ua":
    '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
  "sec-ch-ua-mobile": "?0",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "service-worker-navigation-preload": "true",
  "upgrade-insecure-requests": "1",

  // TODO: use an API key instead
  // or not, API key is only useable for API, not page requests
  // TODO instead: create a dummy youtube account
};

export async function fetchCustomEmojis(
  videoID: string
): Promise<Emoji[] | null> {
  headers.cookie = process.env.GOOGLE_AUTH_COOKIE || "";
  const resp = await fetch(baseURL + videoID, {
    headers,
  });
  const text = await resp.text();

  const m = text.match(/window\[["']ytInitialData["']\]\s*=\s*({.*})/);
  if (!m) {
    return null;
  }
  const json: string | undefined = m[1];
  if (!json) {
    return null;
  }
  try {
    const initialData: YtInitialData = JSON.parse(json);

    return initialData?.contents?.liveChatRenderer?.emojis ?? null;
  } catch (e) {
    console.log(e);
    return null;
  }
}
