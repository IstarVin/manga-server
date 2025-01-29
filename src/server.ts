import { join, extname } from "@std/path";
import StreamZip from "node-stream-zip";
import * as db from "./db.ts";
import { MakeOptional, msToTime, smartSort } from "./utils.ts";
import { ChapterSchema, MangaSchema } from "./models.ts";
import { syncTachidesk } from "./tachidesk.ts";
import config from "./config.ts";
import { Spinner } from "@topcli/spinner";
import { setImmediate } from "node:timers";
import { logInfo, logSuccess } from "@popov/logger";

let scanning = false;

export async function scanLibrary(options?: {
  rescanManga?: boolean;
  deep?: boolean;
  verbose?: boolean;
}) {
  if (scanning) {
    return "Scanning in progress";
  }

  if (options === undefined || options.verbose === undefined) {
    options = { ...options, verbose: true };
  }

  scanning = true;

  logInfo("Started library scan", "Scan Library");

  let totalTimeMs = 0;

  const path = config.mangasPath;

  for await (const source of Deno.readDir(path)) {
    if (source.isFile) continue;

    const sourcePath = join(path, source.name);

    await db.addSource(source.name);

    for await (const manga of Deno.readDir(sourcePath)) {
      if (manga.isFile) continue;

      const startDate = Date.now();

      const mangaPath = join(sourcePath, manga.name);
      const chaptersDir = Array.from(Deno.readDirSync(mangaPath));

      const chapterCount = chaptersDir.filter((v) =>
        v.name.endsWith(".cbz")
      ).length;

      const dbChapterCount = (await db.getMangaChapters(manga.name)).length;

      if (!options?.rescanManga) {
        if (await db.isMangaAdded(manga.name)) {
          if (
            chapterCount == dbChapterCount ||
            (await db.getManga(manga.name))?.status === "COMPLETED"
          ) {
            if (options.verbose) {
              logInfo(`Skipped ${manga.name}`, "Scan Library");
            }
            continue;
          }
        }
      }

      const spinner = new Spinner({
        color: "yellow",
        verbose: options.verbose,
      });
      spinner.start(`Adding ${manga.name}`);

      const mangaDb: MakeOptional<MangaSchema, "id"> = {
        pathName: manga.name,
        source: source.name,
        status: "UNKNOWN",
      };

      const mangaId = await db.addManga(mangaDb);

      mangaDb.id = mangaId;

      const chapters: MakeOptional<ChapterSchema, "chapterNumber">[] = [];

      let c = 0;

      for await (const chapter of Deno.readDir(mangaPath)) {
        const chapterExt = extname(chapter.name);

        if (
          chapter.name.includes("cover") &&
          chapter.name.split(".")[0] === "cover"
        ) {
          mangaDb.cover = chapter.name;
          await db.updateManga(mangaDb as MangaSchema);
        }

        if (chapterExt != ".cbz") continue;

        if (
          !options?.deep &&
          (await db.isChapterAdded(mangaId, chapter.name))
        ) {
          continue;
        }

        const chapterPath = join(mangaPath, chapter.name);
        const chapterName = chapter.name.replace(chapterExt, "");

        const uploadDate = Deno.statSync(chapterPath).birthtime || new Date();

        const newChap = {
          pathName: chapterName,
          pageCount: 1,
          uploadDate,
        };

        if (options?.deep) {
          const zip = new StreamZip.async({ file: chapterPath });

          const pageCount = Object.keys(await zip.entries()).filter(
            (v) => v != "ComicInfo.xml"
          ).length;

          zip.close();

          newChap.pageCount = pageCount;
        }

        chapters.push(newChap);

        spinner.text = `Adding ${manga.name} ${c}/${chapterCount}`;

        c++;

        await new Promise((res) => setImmediate(res));
      }

      await Promise.all(
        chapters
          .sort((a, b) => smartSort(a.pathName, b.pathName))
          .map(async (v, i) => {
            await db.addChapter({ ...v, chapterNumber: i + 1 }, mangaId);
          })
      );

      const timeTookMs = Date.now() - startDate;
      totalTimeMs += timeTookMs;

      spinner.succeed(`Inserted ${manga.name}: ${msToTime(timeTookMs)}`);

      syncTachidesk({ ...mangaDb, id: mangaId });
    }
  }
  logSuccess(`Finished library scan: ${msToTime(totalTimeMs)}`, "Scan Library");
  scanning = false;
}
