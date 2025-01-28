import { join } from "@std/path";
import config from "./config.ts";
import { ChapterSchema, MangaSchema } from "./models.ts";

export type OptionalExceptFor<T, TRequired extends keyof T = keyof T> = Partial<
  Pick<T, Exclude<keyof T, TRequired>>
> &
  Required<Pick<T, TRequired>>;

export type MakeOptional<T, TOptional extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, TOptional>
> &
  Partial<Pick<T, TOptional>>;

export function omit<T extends object, K extends keyof T>(
  object: T,
  ...keys: K[]
): Omit<T, K> {
  const entries = Object.entries(object).filter(
    ([key]) => !keys.includes(key as K)
  );
  return Object.fromEntries(entries) as Omit<T, K>;
}

export function smartSort(a: string, b: string) {
  const numA = parseInt(a.match(/\d+/)?.[0] || "0", 10); // Extract number
  const numB = parseInt(b.match(/\d+/)?.[0] || "0", 10); // Extract number
  return numA - numB;
}

export function getMangaPath(manga: MangaSchema): string {
  return join(config.mangasPath, manga.source, manga.pathName);
}

export function getChapterPath(manga: MangaSchema, chapter: ChapterSchema) {
  return join(getMangaPath(manga), chapter.pathName + ".cbz");
}

const mimeExtensionMap: Record<string, string> = {
  "image/png": "png",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/webp": "webp",
  "image/tiff": "tiff",
  "image/svg+xml": "svg",
  "image/jpeg": "jpg",
};
export function extenionMimeMap(extension: string) {
  const splitExt = extension.split(".");
  if (splitExt.length > 1) {
    extension = splitExt.at(-1)!;
  }

  const index = Object.values(mimeExtensionMap).findIndex(
    (v) => v == extension
  );
  return Object.keys(mimeExtensionMap).at(index);
}

export async function downloadCover(url: string, filePath: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }

  let fileExtension: string = "jpg";
  const contentType = response.headers.get("content-type");
  if (contentType) {
    fileExtension = mimeExtensionMap[contentType] || "jpg";
  }

  const fileData = new Uint8Array(await response.arrayBuffer());
  await Deno.writeFile(filePath + "." + fileExtension, fileData);
}

export function removeScanlator(title: string): string {
  const splitTtile = title.split("_");
  const splitTtile1 = splitTtile[1]?.toLowerCase();
  if (
    splitTtile.length > 1 &&
    (splitTtile1.startsWith("ch") || splitTtile1 == "prologue") &&
    !splitTtile[0].toLowerCase().includes("chapter")
  ) {
    return splitTtile.slice(1).join("_");
  }
  return title;
}

export function createKeyValueObject<T extends string>(
  keys: T[]
): Record<T, T> {
  return keys.reduce((obj, key) => {
    obj[key] = key;
    return obj;
  }, {} as Record<T, T>);
}
