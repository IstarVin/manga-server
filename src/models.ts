export type StatusType =
  | "ONGOING"
  | "COMPLETED"
  | "HIATUS"
  | "DROPPED"
  | "UNKNOWN";

export interface MangaSchema {
  id: number;
  title?: string;
  pathName: string;
  artist?: string;
  author?: string;
  source: string;
  cover?: string;
  status: StatusType;
  description?: string;
  genres?: string[];
}

export interface ChapterSchema {
  title?: string;
  pathName: string;
  scanlator?: string;
  pageCount: number;
  chapterNumber: number;
  uploadDate: Date;
}
