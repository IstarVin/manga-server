import { extname, join } from "@std/path";
import { Spinner } from "@topcli/spinner";
import StreamZip from "node-stream-zip";
import { setImmediate } from "node:timers";
import config from "./config.ts";
import * as db from "./db.ts";
import { ChapterSchema, MangaSchema } from "./models.ts";
import { syncTachidesk } from "./tachidesk.ts";
import { MakeOptional, msToTime, smartSort } from "./utils.ts";

export async function scanLibrary(path: string, options?: { deep?: boolean }) {
  if (options?.deep) {
    console.log("eyy");
  }

  for await (const source of Deno.readDir(path)) {
    if (source.isFile) return;

    const sourcePath = join(path, source.name);

    await db.addSource(source.name);

    for await (const manga of Deno.readDir(sourcePath)) {
      if (manga.isFile) continue;

      if (!config.rescanManga && (await db.isMangaAdded(manga.name))) {
        continue;
      }

      const startDate = Date.now();
      const spinner = new Spinner({ color: "yellow" });
      spinner.start(`Adding ${manga.name}`);

      const mangaPath = join(sourcePath, manga.name);

      const mangaDb: MakeOptional<MangaSchema, "id"> = {
        pathName: manga.name,
        source: source.name,
        status: "UNKNOWN",
      };

      const mangaId = await db.addManga(mangaDb);

      const chapters: MakeOptional<ChapterSchema, "chapterNumber">[] = [];

      for await (const chapter of Deno.readDir(mangaPath)) {
        const chapterExt = extname(chapter.name);

        if (
          chapter.name.includes("cover") &&
          chapter.name.split(".")[0] === "cover"
        ) {
          await db.updateManga({
            ...mangaDb,
            id: mangaId,
            cover: chapter.name,
          });
        }

        if (chapterExt != ".cbz") continue;

        if (
          !config.rescanChapters &&
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

        if (config.deepScan) {
          const zip = new StreamZip.async({ file: chapterPath });

          const pageCount = Object.keys(await zip.entries()).filter(
            (v) => v != "ComicInfo.xml"
          ).length;

          zip.close();

          newChap.pageCount = pageCount;
        }

        chapters.push(newChap);

        await new Promise((res) => setImmediate(res));
      }

      await Promise.all(
        chapters
          .sort((a, b) => smartSort(a.pathName, b.pathName))
          .map(async (v, i) => {
            await db.addChapter({ ...v, chapterNumber: i + 1 }, mangaId);
          })
      );

      spinner.succeed(
        `Inserted ${manga.name}: ${msToTime(Date.now() - startDate)}`
      );

      syncTachidesk({ ...mangaDb, id: mangaId });
    }
  }
}
