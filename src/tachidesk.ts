import { join } from "@std/path";
import config from "./config.ts";
import { ChapterSchema, MangaSchema } from "./models.ts";
import { downloadCover, getMangaPath, removeScanlator } from "./utils.ts";
import { getMangaChapters, updateChapter, updateManga } from "./db.ts";
import { slugify } from "@std/text/unstable-slugify";
import { retry } from "@mr/retry";
import { logError } from "@popov/logger";

type MangaSchemaGraphQL = {
  data: {
    mangas: {
      nodes: (MangaSchema & {
        genre: string[];
        thumbnailUrl: string;
        chapters: {
          nodes: (ChapterSchema & { name: string })[];
        };
      })[];
    };
  };
};

async function updateCovers(manga: MangaSchema, url: string) {
  let hasCover = false;
  const mangaPath = getMangaPath(manga);
  for (const dir of Deno.readDirSync(mangaPath)) {
    if (dir.name.includes("cover")) {
      hasCover = true;
    }
  }
  if (!hasCover) {
    const tachideskUrl = new URL(config.tachideskGraphQLUrl);
    const thumbnailUrl = tachideskUrl.origin + url;

    await downloadCover(thumbnailUrl, join(mangaPath, "cover"));
  }
}

export const syncTachidesk = retry(
  async (manga: MangaSchema) => {
    const query = `
      query mangas($title: String) {
        mangas(filter: {title: {includesInsensitive:$title}, inLibrary: {equalTo: true}}) {
          nodes {
            title
            artist
            author
            description
            genre
            status
            thumbnailUrl

          chapters {
              nodes {
                name
                uploadDate
                scanlator
                pageCount
              }
            }
          }
        }
      }
    `;
    const data = {
      query,
      variables: {
        title: manga.pathName,
      },
    };

    const res = await fetch(config.tachideskGraphQLUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const json: MangaSchemaGraphQL = await res.json();

    const mangas = json.data.mangas.nodes;

    if (mangas.length < 1) {
      return null;
    }

    const pickedManga = mangas[0];

    const mangaReturn: MangaSchema = {
      ...manga,
      title: pickedManga.title,
      artist: pickedManga.artist,
      author: pickedManga.author,
      description: pickedManga.description,
      genres: pickedManga.genre,
      status: pickedManga.status,
    };

    updateManga(mangaReturn);

    const chapters = await getMangaChapters(manga.id);
    const chaptersSlug = pickedManga.chapters.nodes.map((v) => slugify(v.name));

    for (const chapter of chapters) {
      const index = chaptersSlug.findIndex(
        (v) => v == slugify(removeScanlator(chapter.pathName))
      );
      const pickedChaper = pickedManga.chapters.nodes[index];

      if (!pickedChaper) {
        logError(
          `Error getting info for ${manga.pathName}: ${chapter.pathName}`,
          "Tachidesk Sync"
        );

        continue;
      }

      await updateChapter(
        {
          ...chapter,
          title: pickedChaper.name,
          uploadDate: new Date(Number(pickedChaper.uploadDate)),
          scanlator: pickedChaper.scanlator,
          pageCount: pickedChaper.pageCount,
        },
        manga.id
      );
    }

    await updateCovers(manga, pickedManga.thumbnailUrl);

    return mangaReturn;
  },
  { attempts: 20 }
);
