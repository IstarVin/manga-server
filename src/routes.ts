import { Router } from "@oak/oak";
import { join } from "@std/path/join";
import { Status } from "jsr:@oak/commons@1/status";
import StreamZip from "node-stream-zip";
import { z } from "zod";
import * as db from "./db.ts";
import { createErrorMessage } from "./errors.ts";
import { ChapterSchema, MangaSchema } from "./models.ts";
import * as utils from "./utils.ts";
import { scanLibrary } from "./server.ts";

function preprocessManga(manga: MangaSchema) {
  return {
    ...utils.omit(manga, "pathName"),
    thumbnailUrl: `/api/manga/${manga.id}/cover`,
  };
}

function preprocessChapter(chapter: ChapterSchema, mangaId: number) {
  return {
    ...utils.omit(chapter, "pathName"),
    uploadDate: chapter.uploadDate.valueOf(),
    mangaId,
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

    const chapterPath = utils.getChapterPath(manga, chapter);

    const zip = new StreamZip.async({ file: chapterPath });

    const entries = await zip.entries();

    const filteredEntries = Object.values(entries).filter(
      (v) => v.name != "ComicInfo.xml"
    );

    const pickedEntry = filteredEntries[Number(ctx.params.pageId) - 1];

    if (!pickedEntry) {
      ctx.response.status = Status.NotFound;
      ctx.response.body = createErrorMessage("Not found", "Page not found");
      return;
    }

    ctx.response.type = utils.extenionMimeMap(pickedEntry.name);
    ctx.response.body = await zip.entryData(pickedEntry);

    zip.close();
  });

const chapterRouter = new Router<{
  chapter: ChapterSchema;
  manga: MangaSchema;
}>({ prefix: "/chapter" })
  .param("chapId", async (chapId, ctx, next) => {
    const index = Number(chapId);
    const chapter = await db.getChapterWithNumber(index, ctx.state.manga.id);
    if (!chapter) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = createErrorMessage(
        "Invalid request",
        "no chapter found wth the chapId"
      );
      return;
    }
    ctx.state.chapter = chapter;
    await next();
  })
  .get("/all", async (ctx) => {
    const manga = ctx.state.manga;
    ctx.response.body = (await db.getMangaChapters(manga.id))
      .sort((a, b) => b.chapterNumber - a.chapterNumber)
      .map((v) => preprocessChapter(v, manga.id));
  })
  .get("/:chapId", (ctx) => {
    ctx.response.body = preprocessChapter(
      ctx.state.chapter,
      ctx.state.manga.id
    );
  })
  .get("/:chapId", pageRouter.routes());

const mangaRouter = new Router<{ manga: MangaSchema }>({ prefix: "/manga" })
  .param("id", async (id, ctx, next) => {
    const manga = await db.getManga(Number(id));
    if (manga === null) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = createErrorMessage(
        "Not found",
        "No manga found with the givin id"
      );
      return;
    }

    ctx.state.manga = manga;

    await next();
  })
  .get("/all", async (ctx) => {
    const latest = ctx.request.url.searchParams.get("type") === "latest";
    const allMangas = await db.getAllMangas();
    if (latest) {
      allMangas.reverse();
    }
    ctx.response.body = allMangas.map((v) => preprocessManga(v));
  })
  .get("/search", async (ctx) => {
    const query = ctx.request.url.searchParams.get("query");
    if (!query) {
      ctx.response.redirect("/api/manga/all");
      return;
    }

    const mangas = await db.searchMangas(query);
    ctx.response.body = mangas.map((v) => preprocessManga(v));
  })
  .get("/:id", (ctx) => {
    ctx.response.body = preprocessManga(ctx.state.manga);
  })
  .get("/:id/cover", (ctx) => {
    const manga = ctx.state.manga;

    if (!manga.cover) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = "No manga cover found";
      return;
    }

    const cover = Deno.readFileSync(
      join(utils.getMangaPath(manga), manga.cover)
    );
    ctx.response.type = utils.extenionMimeMap(manga.cover);
    ctx.response.body = cover;
  })
  .get("/:id", chapterRouter.routes());

const categoryRouter = new Router<{ category: string }>({ prefix: "/category" })
  .param("id", async (id, ctx, next) => {
    const index = Number(id);
    const categories = await db.getCategories();
    const pickedCategory = categories[index];
    if (!pickedCategory) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = createErrorMessage(
        "Not found",
        "no category found with the given id"
      );
      return;
    }
    ctx.state.category = pickedCategory;
    await next();
  })
  .get("/all", async (ctx) => {
    ctx.response.body = (await db.getCategories()).map((v, i) => {
      return {
        name: v,
        id: i,
        url: `/api/category/${i}`,
      };
    });
  })
  .get("/:id", async (ctx) => {
    ctx.response.body = {
      name: ctx.state.category,
      mangas: (await db.getMangasInCategory(ctx.state.category)).map((v) => {
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

    await db.addMangaToCategory(post.data.mangaId, ctx.state.category);

    ctx.response.status = 200;
  });

export const apiRouter = new Router({ prefix: "/api" })
  .use(mangaRouter.routes())
  .use(categoryRouter.routes())
  .get("/library/scan", async (ctx) => {
    const deep = ctx.request.url.searchParams.get("deep") === "true";
    const blocking = ctx.request.url.searchParams.get("blocking") === "true";
    const rescanManga =
      ctx.request.url.searchParams.get("rescanManga") === "true";

    const opts = { deep, rescanManga, verbose: true };

    if (blocking) {
      await scanLibrary(opts);
      ctx.response.redirect("/api/manga/all");
      return;
    } else {
      scanLibrary(opts);
      ctx.response.body = "Scanning in progress";
    }
    ctx.response.status = Status.OK;
  });
