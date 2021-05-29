import dotenv from "dotenv";
dotenv.config();

import path from "path";
import express from "express";
import process from "process";

import { createFetcher } from "./fetcher";
import { fileExists } from "./utils";

// TODO: add expiration or allow force refetching

const app = express();
const port = parseInt(process.env["PORT"]!) || 3000;
const fetcher = createFetcher();

app.use("/data", express.static("./data"));

app.get("/queue", async (_, res) => {
  res.json(fetcher.getVideoIDs());
});

app.get("/emojis/:channelID/:videoID", async (req, res) => {
  const { channelID, videoID } = req.params;
  if (videoID.length === 0 || channelID.length === 0) {
    res.sendStatus(400);
    return;
  }

  const filename = `./data/${channelID}.json`;
  const url = `/data/${channelID}.json`;
  const exists = await fileExists(filename);
  if (!exists) {
    const ok = await fetcher.queue(videoID, channelID);
    if (!ok) {
      res.status(400).send("failed to fetch emojis");
      return;
    }
  }

  res.redirect(url);
});

app.get("/", (_, res) => {
  res.sendFile(path.resolve("./index.html"));
});

app.listen(port, () => {
  console.log(`listening at http://localhost:${port}`);
});
