import { ChapterSchema, MangaSchema } from "./models.ts";
import { MakeOptional } from "./utils.ts";

export const db = await Deno.openKv(":memory:");

await db.set(["mangaCount"], new Deno.KvU64(1n));

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
  await db.set(["sources", sourceName], sourceName);
}

export async function getSources() {
  return await iterList<string>({ prefix: ["sources"] });
}

export async function addCategory(categoryName: string) {
  await db.set(["categories", categoryName], categoryName);
}

export async function getCategories() {
  return await iterList<string>({ prefix: ["categories"] });
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
    .set(["mangaCategory", categoryName, mangaId], mangaId)
    .set(["mangaCategory", mangaId, categoryName], categoryName)
    .commit();
}

export async function getAllMangas() {
  return await iterList<MangaSchema>({ prefix: ["mangas"] });
}

export async function getMangasInCategory(categoryName: string) {
  const mangas = await iterList<string>({
    prefix: ["mangaCategory", categoryName],
  });
  return await dereference(mangas, getManga);
}

export async function getMangaInSource(sourceName: string) {
  const mangas = await iterList<string>({
    prefix: ["mangaSource", sourceName],
  });
  return await dereference(mangas, getManga);
}

export async function addManga(manga: MakeOptional<MangaSchema, "id">) {
  let res = { ok: false };
  let runCount = 0;
  while (!res.ok) {
    const mangaCount = await db.get<bigint>(["mangaCount"]);
    manga.id = Number(mangaCount.value);

    const mangaIdKey = ["mangas", manga.id];
    const mangaPathKey = ["mangasByPath", manga.pathName];

    res = await db
      .atomic()
      .check(mangaCount)
      .check({ key: mangaIdKey, versionstamp: null })
      .set(mangaPathKey, manga.id)
      .set(mangaIdKey, manga)
      .sum(["mangaCount"], 1n)
      .commit();

    if (runCount >= 30) {
      break;
    }
    if (!res.ok) {
      console.log("Adding again", runCount);

      runCount++;
      continue;
    }

    await addSource(manga.source);

    await addMangaToCategory(manga.id, "Default");

    await db.set(["mangaSource", manga.source, manga.id], manga.id);
  }

  return manga.id!;
}

export async function updateManga(manga: MangaSchema) {
  const mangaKey = ["mangas", manga.id];
  await db.atomic().set(mangaKey, manga).commit();
}

export async function getIdWithPathName(pathName: string) {
  return (await db.get<number>(["mangasByPath", pathName])).value;
}

export async function getManga(mangaIdentifier: MangaIdentifier) {
  const id = await mangaToId(mangaIdentifier);
  if (id === null) return null;

  return (await db.get<MangaSchema>(["mangas", id])).value;
}

export async function getMangaChapters(mangaIdentifier: MangaIdentifier) {
  const id = await mangaToId(mangaIdentifier);
  if (id === null) return [];
  return await iterList<ChapterSchema>({ prefix: ["chapters", id] });
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

  const chapterKey = ["chapters", mangaKey, chapter.pageCount];

  if (opt?.replace) {
    db.delete(chapterKey);
  }
  await db
    .atomic()
    .check({ key: chapterKey, versionstamp: null })
    .set(["chapters", mangaKey, chapter.pathName], chapter)
    .set(["chapterNumber", mangaKey, chapter.chapterNumber], chapter.pathName)
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
    "chapterNumber",
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
  await db.set(["chapters", mangaIdKey, chapter.pathName], chapter);
}

export async function getChapter(
  chapterPath: string,
  mangaIdentifier: MangaIdentifier
) {
  const mangaIdKey = await mangaToId(mangaIdentifier);
  if (mangaIdKey === null) return;
  return (await db.get<ChapterSchema>(["chapters", mangaIdKey, chapterPath]))
    .value;
}
