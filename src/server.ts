import { join, extname } from "@std/path";
import StreamZip from "node-stream-zip";
import * as db from "./db.ts";
import { MakeOptional, msToTime, smartSort } from "./utils.ts";
import { ChapterSchema, MangaSchema } from "./models.ts";
import { syncTachidesk } from "./tachidesk.ts";
import config from "./config.ts";
import { Spinner } from "@topcli/spinner";
import { setImmediate } from "node:timers";

export async function scanLibrary(options?: { deep?: boolean }) {
  if (options?.deep) {
    console.log("eyy");
  }

  let totalTimeMs = 0;

  const path = config.mangasPath;

  for await (const source of Deno.readDir(path)) {
    if (source.isFile) continue;

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

      const chaptersDir = Array.from(Deno.readDirSync(mangaPath));

      const chapterCount = chaptersDir.filter((v) =>
        v.name.endsWith(".cbz")
      ).length;

      spinner.text = `Adding ${manga.name} 0/${chapterCount}`;

      let c = 0;

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
  console.log("Finished library scan:", msToTime(totalTimeMs));
}
