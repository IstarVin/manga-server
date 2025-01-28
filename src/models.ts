import { z } from "zod";

export const StatusType = z.enum([
  "ONGOING",
  "COMPLETED",
  "HIATUS",
  "DROPPED",
  "UNKNOWN",
]);

export const MangaSchema = z.object({
  id: z.number().min(1, "should be greater than one"),
  title: z.string().optional(),
  pathName: z.string(),
  artist: z.string().optional(),
  author: z.string().optional(),
  source: z.string(),
  cover: z.string().optional(),
  status: StatusType,
  description: z.string().optional(),
  genres: z.string().array().optional(),
});

export type MangaSchema = z.infer<typeof MangaSchema>;

export const ChapterSchema = z.object({
  title: z.string().optional(),
  pathName: z.string(),
  scanlator: z.string().optional(),
  pageCount: z.number(),
  chapterNumber: z.number().min(1),
  uploadDate: z.date(),
});

export type ChapterSchema = z.infer<typeof ChapterSchema>;
