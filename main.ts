#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env
// Copyright 2020 justjavac(迷渡). All rights reserved. MIT license.
import { format } from "std/datetime/mod.ts";
import { join } from "std/path/mod.ts";
import { exists } from "std/fs/mod.ts";

import type { Word } from "./types.ts";
import { createArchive, createReadme, mergeWords } from "./utils.ts";

const regexp = /<a href="(\/weibo\?q=[^"]+)".*?>(.+)<\/a>/g;

const envCookie = Deno.env.get("WEIBO_COOKIE");
if (!envCookie) {
  console.warn(
    "WEIBO_COOKIE env var not set; using hardcoded fallback cookie. Set the WEIBO_COOKIE secret in GitHub Actions for easier rotation.",
  );
}
const cookie = envCookie ||
  "SUB=_2AkMWJrkXf8NxqwJRmP8SxWjnaY12zwnEieKgekjMJRMxHRl-yj9jqmtbtRB6PaaX-IGp-AjmO6k5cS-OH2X9CayaTzVD";

const response = await fetch("https://s.weibo.com/top/summary", {
  headers: {
    "Cookie": cookie,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://weibo.com/",
    "Accept-Language": "zh-CN,zh;q=0.9",
  },
});

if (!response.ok) {
  console.error(response.statusText);
  Deno.exit(-1);
}

const result: string = await response.text();

const matches = result.matchAll(regexp);

const words: Word[] = Array.from(matches).map((x) => ({
  url: x[1],
  title: x[2],
}));

if (words.length === 0) {
  console.error(
    "No trending topics found. The scraper may be blocked or the page structure has changed.",
  );
  Deno.exit(1);
}

const yyyyMMdd = format(new Date(), "yyyy-MM-dd");
const fullPath = join("raw", `${yyyyMMdd}.json`);

let wordsAlreadyDownload: Word[] = [];
if (await exists(fullPath)) {
  const content = await Deno.readTextFile(fullPath);
  wordsAlreadyDownload = JSON.parse(content);
}

// 保存原始数据
const queswordsAll = mergeWords(words, wordsAlreadyDownload);
await Deno.writeTextFile(fullPath, JSON.stringify(queswordsAll));

// 更新 README.md
const readme = await createReadme(queswordsAll);
await Deno.writeTextFile("./README.md", readme);

// 更新 archives
const archiveText = createArchive(queswordsAll, yyyyMMdd);
const archivePath = join("archives", `${yyyyMMdd}.md`);
await Deno.writeTextFile(archivePath, archiveText);
