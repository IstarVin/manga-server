import config from "./config.ts";
import { ChapterSchema, MangaSchema } from "./models.ts";
import { createKeyValueObject, MakeOptional } from "./utils.ts";
import { retry } from "@mr/retry";

const P = createKeyValueObject([
  "mangaCount",
  "sources",
  "categories",
  "mangaCategory",
  "mangaSource",
  "mangas",
  "mangasByPath",
  "chapters",
  "chapterNumber",
]);

export const db = await Deno.openKv(config.dbPath);
// export const db = await Deno.openKv(":memory:");

if (!(await db.get([P.mangaCount])).versionstamp) {
  await db.set([P.mangaCount], new Deno.KvU64(1n));
}

type MangaIdentifier = number | string;

async function iterList<T>(selector: Deno.KvListSelector) {
  const _list: T[] = [];

  for await (const item of db.list<T>(selector)) {
    _list.push(item.value);
  }

  return _list;
}

async function dereference<T, U>(
  reference: T[],
  dereferenceFunc: (a: T) => Promise<U>
) {
  return await Promise.all(
    reference.map(async (v) => (await dereferenceFunc(v)) || v)
  );
}

async function mangaToId(mangaId: MangaIdentifier) {
  let id: number | null;
  if (typeof mangaId === "string") {
    id = await getIdWithPathName(mangaId);
    if (id === null) return null;
  } else {
    id = mangaId;
  }
  return id;
}

// async function exists(key: Deno.KvKey) {
//   return Boolean((await db.get(key)).versionstamp);
// }

type addOptions = {
  replace?: boolean;
};

export async function addSource(sourceName: string) {
  await db.set([P.sources, sourceName], sourceName);
}

export async function getSources() {
  return await iterList<string>({ prefix: [P.sources] });
}

export async function addCategory(categoryName: string) {
  await db.set([P.categories, categoryName], categoryName);
}

export async function getCategories() {
  return await iterList<string>({ prefix: [P.categories] });
}

export async function addMangaToCategory(
  mangaIdentifier: MangaIdentifier,
  categoryName: string
) {
  const mangaId = await mangaToId(mangaIdentifier);
  if (mangaId === null) return;

  await addCategory(categoryName);

  await db
    .atomic()
    .set([P.mangaCategory, categoryName, mangaId], mangaId)
    .set([P.mangaCategory, mangaId, categoryName], categoryName)
    .commit();
}

export async function getAllMangas() {
  return await iterList<MangaSchema>({ prefix: [P.mangas] });
}

export async function getMangasInCategory(categoryName: string) {
  const mangas = await iterList<string>({
    prefix: [P.mangaCategory, categoryName],
  });
  return await dereference(mangas, getManga);
}

export async function getMangaInSource(sourceName: string) {
  const mangas = await iterList<string>({
    prefix: [P.mangaSource, sourceName],
  });
  return await dereference(mangas, getManga);
}

export const addManga = retry(
  async (manga: MakeOptional<MangaSchema, "id">) => {
    const mangaCount = await db.get<bigint>([P.mangaCount]);
    manga.id = Number(mangaCount.value);

    const mangaIdKey = [P.mangas, manga.id];
    const mangaPathKey = [P.mangasByPath, manga.pathName];

    const res = await db
      .atomic()
      .check(mangaCount)
      .set(mangaPathKey, manga.id)
      .set(mangaIdKey, manga)
      .sum([P.mangaCount], 1n)
      .commit();

    if (!res.ok) {
      console.log("Adding again");
      throw new Error("Not ok");
    }

    await addSource(manga.source);

    await addMangaToCategory(manga.id, "Default");

    await db.set([P.mangaSource, manga.source, manga.id], manga.id);

    return manga.id;
  },
  { attempts: 20, delay: 0 }
);

export async function updateManga(manga: MangaSchema) {
  const mangaKey = [P.mangas, manga.id];
  await db.atomic().set(mangaKey, manga).commit();
}

export async function getIdWithPathName(pathName: string) {
  return (await db.get<number>([P.mangasByPath, pathName])).value;
}

export async function getManga(mangaIdentifier: MangaIdentifier) {
  const id = await mangaToId(mangaIdentifier);
  if (id === null) return null;

  return (await db.get<MangaSchema>([P.mangas, id])).value;
}

export async function getMangaChapters(mangaIdentifier: MangaIdentifier) {
  const id = await mangaToId(mangaIdentifier);
  if (id === null) return [];
  return await iterList<ChapterSchema>({ prefix: [P.chapters, id] });
}

export async function getMangaWithChapters(mangaIdentifier: MangaIdentifier) {
  const manga = await getManga(mangaIdentifier);
  const chapters = await getMangaChapters(mangaIdentifier);

  return {
    ...manga,
    chapters: chapters,
  };
}

export async function addChapter(
  chapter: ChapterSchema,
  mangaIdentifier: MangaIdentifier,
  opt?: addOptions
) {
  const mangaKey = await mangaToId(mangaIdentifier);

  if (mangaKey === null) return;

  const chapterKey = [P.chapters, mangaKey, chapter.pageCount];

  if (opt?.replace) {
    db.delete(chapterKey);
  }
  await db
    .atomic()
    .check({ key: chapterKey, versionstamp: null })
    .set([P.chapters, mangaKey, chapter.pathName], chapter)
    .set([P.chapterNumber, mangaKey, chapter.chapterNumber], chapter.pathName)
    .commit();
}

export async function getChapterWithNumber(
  chapterNumber: number,
  mangaIdentifier: MangaIdentifier
) {
  const pathName = await getChapterPathName(chapterNumber, mangaIdentifier);
  if (pathName === null) return null;
  return await getChapter(pathName, (await mangaToId(mangaIdentifier))!);
}

export async function getChapterPathName(
  chapterNumber: number,
  mangaIdentifier: MangaIdentifier
) {
  const mangaIdKey = await mangaToId(mangaIdentifier);
  if (mangaIdKey === null) return null;
  const pathName = await db.get<string>([
    P.chapterNumber,
    mangaIdKey,
    chapterNumber,
  ]);
  return pathName.value;
}

export async function updateChapter(
  chapter: ChapterSchema,
  mangaIdentifier: MangaIdentifier
) {
  const mangaIdKey = await mangaToId(mangaIdentifier);
  if (mangaIdKey === null) return;
  await db.set([P.chapters, mangaIdKey, chapter.pathName], chapter);
}

export async function getChapter(
  chapterPath: string,
  mangaIdentifier: MangaIdentifier
) {
  const mangaIdKey = await mangaToId(mangaIdentifier);
  if (mangaIdKey === null) return;
  return (await db.get<ChapterSchema>([P.chapters, mangaIdKey, chapterPath]))
    .value;
}

export async function isMangaAdded(title: string) {
  return Boolean((await db.get([P.mangasByPath, title])).versionstamp);
}

export async function isChapterAdded(
  mangaIdentifier: MangaIdentifier,
  chapterPathName: string
) {
  const mangaIdKey = await mangaToId(mangaIdentifier);
  if (mangaIdKey === null) return;
  return Boolean(
    (await db.get([P.chapters, mangaIdKey, chapterPathName])).versionstamp
  );
}
