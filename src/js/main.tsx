import * as React from "react";
import * as ReactDOM from "react-dom";

import createCache from "./lscache";
import { LiveChat } from "./youtube-chat";

const cs = (...args: (string | boolean)[]) => {
  const result: string[] = [];
  for (const x of args) {
    if (typeof x === "string") {
      result.push(x);
    }
  }
  return result.join(" ");
};

const asyncIter = function <T>(
  xs: T[],
  fn: (x: T) => boolean
): Promise<number> {
  const delay = Math.max(10000 / xs.length, 256);
  return new Promise((resolve) => {
    let index = 0;
    let startTime = Date.now();
    const loop = () => {
      if (index >= xs.length) {
        resolve(Date.now() - startTime);
        return;
      }
      const x = xs[index];
      let stop = false;
      if (x) {
        stop = fn(x);
      }
      index++;
      if (!stop) {
        setTimeout(loop, delay);
      }
    };
    loop();
  });
};

const channelToVideoIDCache = createCache("channelToVideoIDCache");
const videoToChatIDCache = createCache("videoToChatIDCache");

const config = {
  clientId:
    "356891874418-01375urda82dm2eum75pp0jhenpus599.apps.googleusercontent.com",
  scope: "https://www.googleapis.com/auth/youtube",
};

const chatConfig = {
  picSize: 32,
  showNumMessages: 64,
};
const lsKeys = {
  YOUTUBE_ID: "lastYoutubeID",
  OWN_ID: "ownYoutubeChannelID",
  FOLLOWED_USERS: "followedYoutubeUsers",
};

interface LiveStreamInfo {
  channelID?: string;
  chatID: string;
  liveStreamID: string;
}
interface ApiFetchParams {
  path: string;
  params?: Record<string, any>;
}
const apiFetch = (args: ApiFetchParams) => {
  return new Promise((resolve, reject) => {
    gapi.client
      .request({
        path: args.path,
        params: args.params,
      })
      .execute((data) => {
        resolve(data);
      });
  });
};

const fetchVideoID = (channelID: string): Promise<string | undefined> => {
  return new Promise((resolve, reject) => {
    const videoID = channelToVideoIDCache.get(channelID);
    if (videoID) {
      resolve(videoID);
      return;
    }
    gapi.client
      .request({
        path: "https://www.googleapis.com/youtube/v3/search",
        params: {
          eventType: "live",
          part: "id",
          channelId: channelID,
          type: "video",
        },
      })
      .execute((data) => {
        const videoID = data?.items?.[0]?.id?.videoId;
        if (!videoID) {
          channelToVideoIDCache.clear(channelID);
          resolve(undefined);
        } else {
          channelToVideoIDCache.set(channelID, videoID);
          resolve(videoID);
        }
      });
  });
};

const fetchVideo = (videoID: string): Promise<undefined | string> => {
  return new Promise((resolve, reject) => {
    const chatID = videoToChatIDCache.get(videoID);
    if (chatID) {
      resolve(chatID);
      return;
    }
    gapi.client
      .request({
        path: "https://www.googleapis.com/youtube/v3/videos",
        params: {
          part: "liveStreamingDetails",
          id: videoID,
        },
      })
      .execute((data) => {
        const chatID: string | undefined =
          data?.items?.[0]?.liveStreamingDetails?.activeLiveChatId;

        if (!chatID) {
          videoToChatIDCache.clear(videoID);
          resolve(undefined);
        } else {
          videoToChatIDCache.set(videoID, chatID);
          resolve(chatID);
        }
      });
  });
};

const fetchOwnChannelID = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    gapi.client
      .request({
        path: "https://www.googleapis.com/youtube/v3/channels",
        params: {
          part: "id",
          mine: true,
        },
      })
      .execute((data) => {
        const channelID = data?.items?.[0].id;
        resolve((channelID as string) ?? "");
      });
  });
};
//

const fetchLiveStream = async (args: {
  channelID?: string;
  videoID?: string;
}): Promise<LiveStreamInfo | undefined> => {
  let { channelID, videoID } = args;
  if (!videoID) {
    if (!channelID) {
      return undefined;
    }
    videoID = await fetchVideoID(channelID);
  }
  if (!videoID) {
    return undefined;
  }
  const chatID = await fetchVideo(videoID);

  if (!chatID) {
    return undefined;
  }
  return {
    chatID,
    channelID,
    liveStreamID: videoID,
  };

  /*
  Promise((resolve, reject) => {
    const liveStream = liveStreamCache.get(channelID);
    if (liveStream) {
      resolve(liveStream);
      return;
    }
    gapi.client
      .request({
        path: "https://www.googleapis.com/youtube/v3/search",
        params: {
          eventType: "live",
          part: "id",
          channelId: channelID,
          type: "video",
        },
      })
      .execute((data) => {
        const liveStreamID = data?.items?.[0]?.id?.videoId;
        if (!liveStreamID) {
          liveStreamCache.clear(channelID);
          resolve(null);
          return;
        }
        gapi.client
          .request({
            path: "https://www.googleapis.com/youtube/v3/videos",
            params: {
              part: "liveStreamingDetails",
              id: liveStreamID,
            },
          })
          .execute((data) => {
            const chatID =
              data?.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
            if (!chatID) {
              liveStreamCache.clear(channelID);
              resolve(null);
            } else {
              const data = {
                channelID,
                liveStreamID,
                chatID,
              };
              liveStreamCache.set(channelID, data);
              resolve(data);
            }
          });
      });
  });
  */
};

const fetchLiveChats = async (chatID: string, pageToken?: string) => {
  const maxResults = 512;
  const data = await apiFetch({
    path: "https://www.googleapis.com/youtube/v3/liveChat/messages",
    params: {
      liveChatId: chatID,
      pageToken,
      maxResults,
      part: "id,snippet,authorDetails",
      profileImageSize: 16,
    },
  });
  return data as YouTubeLiveChatResponse;
};

const submitChatMessage = (chatID: string, text: string) => {
  return new Promise((resolve) => {
    gapi.client
      .request({
        path: "https://www.googleapis.com/youtube/v3/liveChat/messages",
        method: "POST",
        params: {
          part: "snippet",
        },
        body: {
          snippet: {
            liveChatId: chatID,
            type: "textMessageEvent",
            textMessageDetails: {
              messageText: text,
            },
          },
          //snippet.type: Currently, the only supported value is textMessageEvent.
          //snippet.textMessageDetails.messageText
        },
      })
      .execute((data) => {
        resolve(data);
      });
  });
};

const addChatMessage = (
  messages: YouTubeLiveChatMessage[],
  message: YouTubeLiveChatMessage
) => {
  const _messages = [message, ...messages];
  if (_messages.length > chatConfig.showNumMessages) {
    _messages.splice(_messages.length - 1, _messages.length);
  }
  return _messages;
};

interface PollChat {
  stop: () => void;
}
const pollChatMessges = (
  liveChatId: string,
  onMessage: (arg: YouTubeLiveChatMessage) => void,
  onError: (arg: YouTubeErrorObject) => void
): PollChat => {
  const minRequestDelay = 2000;
  let stopped = false;
  let firstRun = true;
  const resultsFetchLoop = async (result: YouTubeLiveChatResponse) => {
    if (stopped) {
      return;
    }
    if (!result) {
      onError({
        code: 0,
        message: "Unkonwn error occurred - no result object was given",
      } as YouTubeErrorObject);
    } else if (result.error) {
      onError(result.error as YouTubeErrorObject);
    } else {
      let chatEndedFlag = false;
      let elapsed = 0;
      let fn = (message: YouTubeLiveChatMessage) => {
        const url = message.authorDetails.profileImageUrl;
        if (url) {
          message.authorDetails.profileImageUrl = url.replace(
            "=s16-",
            `=s${chatConfig.picSize}-`
          );
        }
        onMessage(message);
        if (message.snippet.type === "chatEndedEvent") {
          chatEndedFlag = true;
        }
        return stopped;
      };
      if (firstRun) {
        firstRun = false;
        for (const message of result.items) {
          fn(message);
        }
      } else {
        elapsed = await asyncIter(result.items, fn);
      }

      /*
      for (const message of result.items) {
        const url = message.authorDetails.profileImageUrl;
        if (url) {
          message.authorDetails.profileImageUrl = url.replace("=s16-", "=s64-");
        }
        onMessage(message);
        if (message.snippet.type === "chatEndedEvent") {
          chatEndedFlag = true;
        }
      }
      */
      if (stopped || result.offlineAt || chatEndedFlag) {
        return;
      }
      const pollSleepTime = Math.max(
        result.pollingIntervalMillis - elapsed,
        minRequestDelay
      );
      setTimeout(() => {
        fetchLiveChats(liveChatId, result.nextPageToken).then(resultsFetchLoop);
      }, pollSleepTime);
    }
  };
  fetchLiveChats(liveChatId, undefined).then(resultsFetchLoop);

  return {
    stop: () => (stopped = true),
  };
};

function EmbeddedBrowser() {
  const inputURLRef = React.useRef<HTMLInputElement>(null);
  const browserRef = React.useRef<HTMLIFrameElement>(null);
  const handleOpenURL = () => {
    const inputURL = inputURLRef.current;
    const iframe = browserRef.current;
    if (!iframe || !inputURL) {
      return;
    }
    iframe.src = inputURL.value;
  };
  return (
    <div>
      <input placeholder="url" ref={inputURLRef} />
      <button onClick={handleOpenURL}>open</button>
      <br />
      <iframe
        ref={browserRef}
        frameBorder="0"
        allowFullScreen
        scrolling="no"
      ></iframe>
    </div>
  );
}

function Main() {
  const channelIDRef = React.useRef<HTMLInputElement>(null);
  const videoIDRef = React.useRef<HTMLInputElement>(null);
  const inputMessageRef = React.useRef<HTMLInputElement>(null);
  const [liveStream, setLiveStream] =
    React.useState<LiveStreamInfo | null>(null);
  const [signedIn, setSignedIn] = React.useState(false);
  const [chat, setChat] = React.useState<PollChat | null>(null);
  const [messages, setMessages] = React.useState<YouTubeLiveChatMessage[]>([]);
  const [followedMessages, setFollowedMessages] = React.useState<
    YouTubeLiveChatMessage[]
  >([]);
  const [followedUsers, setFollowedUsers] = React.useState<
    Record<string, boolean>
  >({});
  const [sending, setSending] = React.useState(false);
  const [ownChannelID, setOwnChannelID] = React.useState("");
  const [focusedChat, setFocusedChat] =
    React.useState<YouTubeLiveChatMessage | null>(null);
  const [newMessage, setNewMessage] =
    React.useState<YouTubeLiveChatMessage | null>(null);
  const [paused, setPaused] = React.useState(false);

  const onAuth = () => {
    const resp = gapi.auth2.getAuthInstance().signIn({
      clientid: config.clientId,
    });
    console.log("signIn resp", resp);
  };

  const handleLoadChat = async (e: React.FormEvent | null) => {
    if (e) {
      e.preventDefault();
    }
    if (chat) {
      chat.stop();
    }

    const args = {
      channelID: channelIDRef.current?.value,
      videoID: videoIDRef.current?.value,
    };
    const liveStream = await fetchLiveStream(args);
    if (!liveStream) {
      alert("invalid channelID or videoID");
      return;
    }

    localStorage[lsKeys.YOUTUBE_ID] = liveStream.liveStreamID;

    const _chat = pollChatMessges(
      liveStream?.chatID,
      (message) => {
        //addMessage(message)
        setNewMessage(message);
      },
      (error) => {
        console.log("an error occured while loading chat", error);
      }
    );
    setChat(_chat);
    setLiveStream(liveStream);

    try {
      const users = JSON.parse(localStorage[lsKeys.FOLLOWED_USERS]);
      if (users && typeof users === "object") {
        setFollowedUsers(users);
      }
    } catch (e) {}
  };
  const addMessage = (message: YouTubeLiveChatMessage) => {
    const { authorDetails: author } = message;
    if (
      author.isChatModerator ||
      author.isChatOwner ||
      author.channelId === ownChannelID ||
      followedUsers[author.channelId]
    ) {
      setFollowedMessages((messages) => addChatMessage(messages, message));
    } else {
      setMessages((messages) => addChatMessage(messages, message));
    }
  };

  React.useEffect(() => {
    if (newMessage && !paused) {
      addMessage(newMessage);
    }
  }, [newMessage]);

  React.useEffect(() => {
    const start = () => {
      gapi.client
        .init({
          clientId: config.clientId,
          scope: config.scope,
        })
        .then(async function () {
          gapi.auth2
            .getAuthInstance()
            .isSignedIn.listen((signedIn: boolean) => {
              console.log("sign in state change", signedIn);
              setSignedIn(signedIn);
            });
          const signedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
          setSignedIn(signedIn);
          if (signedIn) {
            let id: string = localStorage[lsKeys.OWN_ID];
            if (!id || typeof id !== "string") {
              id = await fetchOwnChannelID();
              localStorage[lsKeys.OWN_ID] = id;
            }
            if (id) {
              setOwnChannelID(id);
            }
          }
          const videoIDInput = videoIDRef.current;
          if (videoIDInput) {
            videoIDInput.value = localStorage.lastYoutubeID || "";
            if (videoIDInput.value) {
              handleLoadChat(null);
            }
          }
        });
    };
    gapi.load("client:auth2", start);
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputMessage = inputMessageRef.current;
    if (!inputMessage) {
      return;
    }
    const text = inputMessage.value;
    if (!text || text?.length === 0 || !liveStream) {
      return;
    }

    setSending(true);
    await submitChatMessage(liveStream?.chatID, text);
    setSending(false);
    inputMessage.value = "";
  };

  const handlePause = () => setPaused(!paused);

  const addFollowedUsers = (channelID: string) => {
    const remove = followedUsers[channelID];
    const users = { ...followedUsers, [channelID]: true };
    if (remove) {
      delete users[channelID];
    }
    setFollowedUsers(users);
    localStorage[lsKeys.FOLLOWED_USERS] = JSON.stringify(users);
  };

  const renderMessage = (message: YouTubeLiveChatMessage) => {
    const { snippet, authorDetails: author } = message;
    if (snippet.type === "textMessageEvent") {
      return (
        <div
          className={cs(
            "message",
            author.isChatOwner
              ? "is-admin"
              : author.isChatModerator
              ? "is-mod"
              : author.isChatSponsor
              ? "is-sub"
              : ""
          )}
        >
          <img src={message.authorDetails.profileImageUrl} />
          <div>
            <div className={"message-username"}>
              {message.authorDetails.displayName}
            </div>
            <div className="message-text">{snippet.displayMessage}</div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <script src="https://apis.google.com/js/api.js"></script>
      {!signedIn && <button onClick={onAuth}>auth</button>}
      {signedIn && (
        <form onSubmit={handleLoadChat}>
          {/*
          <div>
            <input ref={channelIDRef} placeholder="channelID" />
            <button>load chat</button>
          </div>
          */}
          <div>
            <input
              name="videoID"
              id="videoID"
              ref={videoIDRef}
              placeholder="videoID"
            />
            <button>load</button>
          </div>
        </form>
      )}
      {chat && (
        <div className="main-content">
          <div>
            <div className="all-messages-container">
              <div>
                <form onSubmit={handleSend}>
                  <input disabled={sending} ref={inputMessageRef} />
                  <button disabled={sending}>send</button>
                </form>
                <div>Followed messages</div>
                <div className="messages-container">
                  {followedMessages.map((msg) => (
                    <div
                      key={msg.id}
                      id={msg.id}
                      onClick={() => setFocusedChat(msg)}
                    >
                      {renderMessage(msg)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mid-content">
                <iframe
                  width="800"
                  height="415"
                  src={
                    "https://www.youtube.com/embed/" + liveStream?.liveStreamID
                  }
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
                {/*
                <iframe
                  src={
                    "https://player.twitch.tv/?channel=bubb4bot&parent=" +
                    location.hostname
                  }
                  frameBorder="0"
                  allowFullScreen
                  scrolling="no"
                  height="378"
                  width="620"
                ></iframe>
                */}
              </div>
              <div>
                <div>
                  All messages{" "}
                  <button onClick={handlePause}>{paused ? "▶️" : "⏸️"}</button>
                </div>
                <div className="messages-container">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      id={msg.id}
                      onClick={() => setFocusedChat(msg)}
                    >
                      {renderMessage(msg)}
                    </div>
                  ))}
                </div>
              </div>

              {focusedChat && (
                <div>
                  {renderMessage(focusedChat)}
                  channelID: {focusedChat.authorDetails.channelId}
                  <button
                    onClick={() =>
                      addFollowedUsers(focusedChat.authorDetails.channelId)
                    }
                  >
                    {followedUsers[focusedChat.authorDetails.channelId]
                      ? "✗ remove from follow list"
                      : "◎ add to follow list"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/*
      <div>Mobile viewer</div>
      */}
    </div>
  );
}

window.onload = () => {
  const domContainer = document.querySelector("#react-container");
  ReactDOM.render(<Main />, domContainer);
};
