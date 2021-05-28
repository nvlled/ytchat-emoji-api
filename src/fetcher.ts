import fs from "fs";
import { fetchCustomEmojis } from "./scrapper";

import { fileExists } from "./utils";

export const createFetcher = () => {
  let running = false;
  const queueLimit = 5000;
  const delay = 1000;
  const videoIDs: { videoID: string; channelID: string }[] = [];
  const listeners: Record<string, (() => void)[]> = {};

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
        listeners[videoID]?.push(() => resolve(null));

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

  const loop = async () => {
    running = true;
    const item = videoIDs.shift();

    if (item) {
      const { videoID, channelID } = item;
      const filename = `./data/${channelID}.json`;

      const exists = await fileExists(filename);
      if (!exists) {
        console.log("fetching", videoID);
        const emojis = await fetchCustomEmojis(videoID);
        if (emojis && emojis.length > 0) {
          await fs.promises.mkdir("./data", { recursive: true });
          await fs.promises.writeFile(filename, JSON.stringify(emojis));
          for (const fn of listeners[videoID] ?? []) {
            fn();
          }
          console.log("wrote file on", filename, "for video", videoID);
          delete listeners[videoID];
        } else {
          console.log("no emojis found for", videoID);
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
