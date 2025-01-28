import { Router } from "@oak/oak";
import {
  addMangaToCategory,
  getAllMangas,
  getCategories,
  getChapterWithNumber,
  getManga,
  getMangaChapters,
  getMangasInCategory,
} from "./db.ts";
import {
  extenionMimeMap,
  getChapterPath,
  getMangaPath,
  omit,
} from "./utils.ts";
import { MangaSchema, ChapterSchema } from "./models.ts";
import { join } from "@std/path/join";
import StreamZip from "node-stream-zip";
import { z } from "zod";
import { Status } from "jsr:@oak/commons@1/status";
import { createErrorMessage } from "./errors.ts";

function preprocessManga(manga: MangaSchema) {
  return {
    ...omit(manga, "pathName"),
    thumbnailUrl: `/api/manga/${manga.id}/cover`,
  };
}

function preprocessChapter(chapter: ChapterSchema) {
  return {
    ...omit(chapter, "pathName"),
    uploadDate: chapter.uploadDate.valueOf(),
  };
}

const pageRouter = new Router<{ manga: MangaSchema; chapter: ChapterSchema }>({
  prefix: "/page",
})
  .get("/all", (ctx) => {
    const pageCount = ctx.state.chapter.pageCount;
    const pages = [];

    const mangaId = ctx.params.id;
    const chapterId = ctx.params.chapId;

    for (let i = 0; i < pageCount; i++) {
      pages.push({
        url: `/api/manga/${mangaId}/chapter/${chapterId}/page/${i + 1}`,
      });
    }

    ctx.response.body = pages;
  })
  .get("/:pageId", async (ctx) => {
    const manga = ctx.state.manga;
    const chapter = ctx.state.chapter;

    const chapterPath = getChapterPath(manga, chapter);

    const zip = new StreamZip.async({ file: chapterPath });

    const entries = await zip.entries();

    const filteredEntries = Object.values(entries).filter(
      (v) => v.name != "ComicInfo.xml"
    );

    const pickedEntry = filteredEntries[Number(ctx.params.pageId) - 1];

    if (!pickedEntry) {
      ctx.response.status = Status.NotFound;
      return;
    }

    ctx.response.type = extenionMimeMap(pickedEntry.name);
    ctx.response.body = await zip.entryData(pickedEntry);

    zip.close();
  });

const chapterRouter = new Router<{
  chapter: ChapterSchema;
  manga: MangaSchema;
}>({ prefix: "/chapter" })
  .param("chapId", async (chapId, ctx, next) => {
    const index = Number(chapId);
    const chapter = await getChapterWithNumber(index, ctx.state.manga.id);
    if (!chapter) {
      ctx.response.status = Status.BadRequest;
      return;
    }
    ctx.state.chapter = chapter;
    await next();
  })
  .get("/all", async (ctx) => {
    const manga = ctx.state.manga;
    ctx.response.body = (await getMangaChapters(manga.id)).sort(
      (a, b) => a.chapterNumber - b.chapterNumber
    );
  })
  .get("/:chapId", (ctx) => {
    ctx.response.body = preprocessChapter(ctx.state.chapter);
  })
  .get("/:chapId", pageRouter.routes());

const mangaRouter = new Router<{ manga: MangaSchema }>({ prefix: "/manga" })
  .param("id", async (id, ctx, next) => {
    const manga = await getManga(Number(id));
    if (manga === null) {
      ctx.response.status = Status.BadRequest;
      return;
    }

    ctx.state.manga = manga;

    await next();
  })
  .get("/all", async (ctx) => {
    ctx.response.body = (await getAllMangas()).map((v) => preprocessManga(v));
  })
  .get("/:id", (ctx) => {
    ctx.response.body = preprocessManga(ctx.state.manga);
  })
  .get("/:id/cover", (ctx) => {
    const manga = ctx.state.manga;

    if (!manga.cover) {
      ctx.response.status = Status.BadRequest;
      return;
    }

    const cover = Deno.readFileSync(join(getMangaPath(manga), manga.cover));
    ctx.response.type = extenionMimeMap(manga.cover);
    ctx.response.body = cover;
  })
  .get("/:id", chapterRouter.routes());

const categoryRouter = new Router<{ category: string }>({ prefix: "/category" })
  .param("id", async (id, ctx, next) => {
    const index = Number(id) - 1;
    const categories = await getCategories();
    const pickedCategory = categories[index];
    if (!pickedCategory) {
      ctx.response.status = Status.BadRequest;
      return;
    }
    ctx.state.category = pickedCategory;
    await next();
  })
  .get("/all", async (ctx) => {
    ctx.response.body = (await getCategories()).map((v, i) => {
      return {
        name: v,
        url: `/api/category/${i + 1}`,
      };
    });
  })
  .get("/:id", async (ctx) => {
    ctx.response.body = {
      name: ctx.state.category,
      mangas: (await getMangasInCategory(ctx.state.category)).map((v) => {
        if (typeof v === "string") {
          return v;
        }
        return preprocessManga(v);
      }),
    };
  })
  .post("/:id", async (ctx) => {
    const zCategoryPost = z.object({
      mangaId: z.number(),
    });
    const post = zCategoryPost.safeParse(await ctx.request.body.json());
    if (post.error) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = createErrorMessage(
        "Invalid passed body",
        post.error.issues
      );
      return;
    }

    await addMangaToCategory(post.data.mangaId, ctx.state.category);

    ctx.response.status = 200;
  });

export const apiRouter = new Router({ prefix: "/api" })
  .use(mangaRouter.routes())
  .use(categoryRouter.routes());
