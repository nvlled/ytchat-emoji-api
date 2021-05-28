import dotenv from "dotenv";
dotenv.config();

import express from "express";
import process from "process";

import { createFetcher } from "./fetcher";
import { fileExists } from "./utils";

const app = express();
const port = parseInt(process.env["PORT"]!) || 3000;
const fetcher = createFetcher();

app.use("/data", express.static("./data"));

app.get("/queue", async (req, res) => {
  res.json(fetcher.getVideoIDs());
});

app.get("/custom_emojis", async (req, res) => {
  const { v: videoID = "", c: channelID = "" } = req.query;
  if (
    typeof videoID !== "string" ||
    typeof channelID !== "string" ||
    videoID.length === 0 ||
    channelID.length === 0
  ) {
    res.sendStatus(400);
    return;
  }

  const filename = `./data/${channelID}.json`;
  const url = `/data/${channelID}.json`;
  const exists = await fileExists(filename);
  if (!exists) {
    await fetcher.queue(videoID, channelID);
  }

  res.redirect(url);
});

app.listen(port, () => {
  console.log(`listening at http://localhost:${port}`);
});
