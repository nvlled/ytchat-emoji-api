import fs from "fs";
import { fetchEmojis } from "./scrapper";

import { fileExists } from "./utils";

export const createFetcher = () => {
  let running = false;
  const queueLimit = 5000;
  const delay = 1000;
  const videoIDs: { videoID: string; channelID: string }[] = [];
  const listeners: Record<string, ((ok: boolean) => void)[]> = {};

  const self = {
    queue(videoID: string, channelID: string) {
      return new Promise((resolve, reject) => {
        if (videoIDs.length >= queueLimit) {
          reject("too much load");
          return;
        }
        if (!listeners[videoID]) {
          listeners[videoID] = [];
        }
        listeners[videoID]?.push((ok: boolean) => resolve(ok));

        videoIDs.push({ videoID, channelID });
        if (!running) {
          loop();
        }
      });
    },
    getVideoIDs() {
      return videoIDs.slice();
    },
  };

  const notify = (videoID: string, ok: boolean) => {
    for (const fn of listeners[videoID] ?? []) {
      fn(ok);
    }
    delete listeners[videoID];
  };

  const loop = async () => {
    running = true;
    const item = videoIDs.shift();

    if (item) {
      const { videoID, channelID } = item;
      let filename = `./data/${channelID}.json`;

      const exists = await fileExists(filename);
      if (exists) {
        notify(videoID, true);
      } else {
        console.log("fetching", videoID);
        const result = await fetchEmojis(videoID);
        try {
          if (result) {
            const { emojis, channelID: actualChannelID } = result;
            if (actualChannelID && channelID != actualChannelID) {
              filename = `./data/${actualChannelID}.json`;
            }
            await fs.promises.mkdir("./data", { recursive: true });
            await fs.promises.writeFile(filename, JSON.stringify(emojis));
            notify(videoID, true);
            console.log("wrote file on", filename, "for video", videoID);
          } else {
            notify(videoID, false);
            console.log("no emojis found for", videoID);
          }
        } catch (e) {
          notify(videoID, false);
        }
      }
    }

    if (videoIDs.length === 0) {
      running = false;
    } else {
      setTimeout(loop, delay);
    }
  };

  return self;
};
