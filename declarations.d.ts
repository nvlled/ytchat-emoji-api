declare module "testlib" {
  export function foo(val: number): any;
}

interface YouTubeErrorObject {
  code: number;
  message: string;
  errors: {
    message: string;
    domain: string;
    reason: string;
  }[];
}
interface YouTubeLiveChatResponse {
  kind: "youtube#liveChatMessageListResponse";
  etag: string;
  nextPageToken: string;
  pollingIntervalMillis: number;
  offlineAt: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  error?: YouTubeErrorObject;
  items: YouTubeLiveChatMessage[];
}
interface YouTubeLiveChatMessage {
  kind: "youtube#liveChatMessage";
  etag: string;
  id: string;
  snippet:
    | YouTubeNoExtraBodyEvent
    | YouTubeSuperStickerEvent
    | YouTubeSuperChatEvent
    | YouTubeUserBannedEvent
    | YouTubeMessageDeletedEvent
    | YouTubeTextMessageEvent;
  authorDetails: {
    channelId: string;
    channelUrl: string;
    displayName: string;
    profileImageUrl: string;
    isVerified: boolean;
    isChatOwner: boolean;
    isChatSponsor: boolean;
    isChatModerator: boolean;
  };
}

interface YouTubeChatSnippet {
  liveChatId: string;
  authorChannelId: string;
  publishedAt: string;
  hasDisplayContent: boolean;
}

interface YouTubeTextMessageEvent extends YouTubeChatSnippet {
  type: "textMessageEvent";
  displayMessage: string;
  textMessageDetails: {
    messageText: string;
  };
}

interface YouTubeMessageDeletedEvent extends YouTubeChatSnippet {
  type: "messageDeletedEvent";
  messageDeletedDetails: {
    deletedMessageId: string;
  };
}

interface YouTubeUserBannedEvent extends YouTubeChatSnippet {
  type: "userBannedEvent";
  userBannedDetails: {
    bannedUserDetails: {
      channelId: string;
      channelUrl: string;
      displayName: string;
      profileImageUrl: string;
    };
    banType: "permanent" | "temporary";
    banDurationSeconds?: number;
  };
}

interface YouTubeSuperChatEvent extends YouTubeChatSnippet {
  type: "superChatEvent";
  superChatDetails: {
    amountMicros: number;
    currency: string;
    amountDisplayString: string;
    userComment: string;
    tier: number;
  };
}

interface YouTubeSuperStickerEvent extends YouTubeChatSnippet {
  type: "superStickerEvent";
  superStickerDetails: {
    superStickerMetadata: {
      stickerId: string;
      altText: string;
      language: string;
    };
    amountMicros: number;
    currency: string;
    amountDisplayString: string;
    userComment: string;
    tier: number;
  };
}

interface YouTubeNoExtraBodyEvent extends YouTubeChatSnippet {
  type:
    | "chatEndedEvent"
    | "newSponsorEvent"
    | "sponsorOnlyModeEndedEvent"
    | "sponsorOnlyModeStartedEvent"
    | "tombstone";
}
