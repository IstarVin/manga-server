import { join, extname } from "@std/path";
import StreamZip from "node-stream-zip";
import {
  addSource,
  addManga,
  addChapter,
  updateManga,
  isMangaAdded,
  isChapterAdded,
} from "./db.ts";
import { MakeOptional, smartSort } from "./utils.ts";
import { ChapterSchema, MangaSchema } from "./models.ts";
import { syncTachidesk } from "./tachidesk.ts";
import config from "./config.ts";

export async function scanLibrary(path: string, options?: { deep?: boolean }) {
  if (options?.deep) {
    console.log("eyy");
  }
  for (const source of Deno.readDirSync(path)) {
    if (source.isFile) continue;

    const sourcePath = join(path, source.name);

    await addSource(source.name);

    for (const manga of Deno.readDirSync(sourcePath)) {
      if (manga.isFile) continue;

      if (!config.rescanManga && (await isMangaAdded(manga.name))) {
        continue;
      }

      const mangaPath = join(sourcePath, manga.name);

      const mangaDb: MakeOptional<MangaSchema, "id"> = {
        pathName: manga.name,
        source: source.name,
        status: "UNKNOWN",
      };

      const mangaId = await addManga(mangaDb);

      const chapters: MakeOptional<ChapterSchema, "chapterNumber">[] = [];

      for (const chapter of Deno.readDirSync(mangaPath)) {
        const chapterExt = extname(chapter.name);

        if (
          chapter.name.includes("cover") &&
          chapter.name.split(".")[0] === "cover"
        ) {
          await updateManga({ ...mangaDb, id: mangaId, cover: chapter.name });
        }

        if (chapterExt != ".cbz") continue;

        if (
          !config.rescanChapters &&
          (await isChapterAdded(mangaId, chapter.name))
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
      }

      await Promise.all(
        chapters
          .sort((a, b) => smartSort(a.pathName, b.pathName))
          .map(async (v, i) => {
            await addChapter({ ...v, chapterNumber: i + 1 }, mangaId);
          })
      );

      console.log(`Inserted ${manga.name}`);

      syncTachidesk({ ...mangaDb, id: mangaId });
    }
  }
}
