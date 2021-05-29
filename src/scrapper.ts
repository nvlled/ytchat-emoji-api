import fetch from "node-fetch";

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
  contents: any;
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

function matchYtInitialData(html: string) {
  const m = html.match(
    /(?:var\s*ytInitialData|window\[["']ytInitialData["']\])\s*=\s*({.*});/
  );
  if (!m) {
    return null;
  }
  const json: string | undefined = m[1];
  if (!json) {
    return null;
  }
  return json;
}

export async function fetchEmojis(videoID: string) {
  headers.cookie = process.env.GOOGLE_AUTH_COOKIE || "";
  const resp = await fetch(`https://www.youtube.com/watch?v=${videoID}`, {
    headers,
    method: "GET",
  });
  try {
    const json = matchYtInitialData(await resp.text());
    if (!json) {
      return null;
    }

    const ytInitialData: any = JSON.parse(json);
    const buttonRenderer =
      ytInitialData.contents?.twoColumnWatchNextResults?.results?.results
        ?.contents?.[1]?.videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer
        ?.membershipButton?.buttonRenderer;
    if (!buttonRenderer) {
      return null;
    }
    const isSubscribed = !!(
      !buttonRenderer.serviceEndpoint || buttonRenderer.navigationEndpoint
    );

    if (isSubscribed) {
      return fetchSubscribed(ytInitialData);
    } else {
      return fetchUnsubscribed(ytInitialData);
    }
  } catch (e) {
    return null;
  }
}

export async function fetchSubscribed(ytInitialData: YtInitialData) {
  headers.cookie = process.env.GOOGLE_AUTH_COOKIE || "";

  const fetchMembersPage = async () => {
    try {
      const buttonRenderer =
        ytInitialData?.contents?.twoColumnWatchNextResults?.results?.results
          ?.contents?.[1]?.videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer
          ?.membershipButton?.buttonRenderer;
      const membersPageUrl: string =
        buttonRenderer?.navigationEndpoint?.commandMetadata?.webCommandMetadata
          ?.url;
      const channelID: string =
        buttonRenderer?.navigationEndpoint?.browseEndpoint?.browseId;

      if (!membersPageUrl || !channelID) {
        return [];
      }

      return [`https://youtube.com/${membersPageUrl}`, channelID];
    } catch (e) {
      console.log(e);
      return [];
    }
  };
  const fetchEmojis = async (membersPageUrl: string) => {
    const resp = await fetch(membersPageUrl, { headers });
    try {
      const json = matchYtInitialData(await resp.text());
      if (!json) {
        return null;
      }
      const ytInitialData: any = JSON.parse(json);
      const images =
        ytInitialData?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[4]
          ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
          ?.sponsorshipsManagementRenderer?.content?.[3]
          ?.sponsorshipsExpandableMessageRenderer?.expandableItems?.[0]
          ?.sponsorshipsPerksRenderer?.perks?.[0]?.sponsorshipsPerkRenderer
          ?.images;
      const emojiMap: Record<string, string> = {};
      for (const image of images) {
        const i = image.thumbnails?.length - 1;
        const url = image.thumbnails[i].url;
        const emojiCode = image?.accessibility.accessibilityData.label;
        if (!url || !emojiCode) {
          continue;
        }
        emojiMap[`:_${emojiCode}:`] = url;
      }
      return emojiMap;
    } catch (e) {
      console.log(e);
      return null;
    }
  };

  const [membersPageUrl, channelID] = await fetchMembersPage();
  if (!membersPageUrl || !channelID) {
    return null;
  }
  const emojis = await fetchEmojis(membersPageUrl);
  return { emojis, channelID };
}

export async function fetchUnsubscribed(ytInitialData: YtInitialData) {
  headers.cookie = process.env.GOOGLE_AUTH_COOKIE || "";
  const fetchItemParams = async () => {
    try {
      const membershipButton =
        ytInitialData?.contents?.twoColumnWatchNextResults?.results?.results
          ?.contents[1]?.videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer
          ?.membershipButton;

      const itemParams =
        membershipButton?.buttonRenderer?.serviceEndpoint?.ypcGetOffersEndpoint
          ?.params;
      return itemParams;
    } catch (e) {
      console.log(e);
      return [];
    }
  };
  const fetchEmojis = async (itemParams: string) => {
    const resp = await fetch(
      "https://www.youtube.com/youtubei/v1/ypc/get_offers?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      {
        headers: {
          ...headers,
          authorization: "SAPISIDHASH " + process.env.SAPISIDHASH,
          "content-type": "application/json",
          origin: "https://www.youtube.com",
          "accept-language": "en-US,en;q=0.9",
        },
        body: `{"context":{"client":{"clientName":"WEB","clientVersion":"2.20210526.07.00"}},"itemParams":"${itemParams}"}`,
        method: "POST",
      }
    );
    return await resp.text();
  };

  const itemParams = await fetchItemParams();
  if (!itemParams) {
    return null;
  }
  const emojiResp = JSON.parse(await fetchEmojis(itemParams));
  const images =
    emojiResp?.actions?.[0]?.openPopupAction?.popup?.sponsorshipsOfferRenderer
      ?.tiers?.[0]?.sponsorshipsTierRenderer?.perks?.sponsorshipsPerksRenderer
      ?.perks?.[1]?.sponsorshipsPerkRenderer?.images;

  const emojiMap: Record<string, string> = {};
  for (const image of images) {
    const i = image.thumbnails?.length - 1;
    const url = image.thumbnails[i].url;
    const emojiCode = image?.accessibility.accessibilityData.label;
    if (!url || !emojiCode) {
      continue;
    }
    emojiMap[`:_${emojiCode}:`] = url;
  }
  const channelID: string =
    ytInitialData?.contents?.twoColumnWatchNextResults?.results?.results
      ?.contents?.[1]?.videoSecondaryInfoRenderer?.subscribeButton
      ?.subscribeButtonRenderer.channelId;

  return { emojis: emojiMap, channelID };
}

export async function fetchEmojisFromChatPopup(
  videoID: string
): Promise<Emoji[] | null> {
  headers.cookie = process.env.GOOGLE_AUTH_COOKIE || "";
  const baseURL = "https://www.youtube.com/live_chat?is_popout=1&v=";
  const resp = await fetch(baseURL + videoID, {
    headers,
  });

  const json = matchYtInitialData(await resp.text());
  if (!json) {
    return null;
  }
  try {
    const ytInitialData: YtInitialData = JSON.parse(json);

    return ytInitialData?.contents?.liveChatRenderer?.emojis ?? null;
  } catch (e) {
    console.log(e);
    return null;
  }
}
