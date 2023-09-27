package database

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"github.com/mitchellh/mapstructure"
	"github.com/ostafen/clover/v2/document"
	"github.com/ostafen/clover/v2/query"
	"github.com/pkg/errors"
	"io"
	"manga-server/config"
	"manga-server/models"
	"os"
	"path"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"time"
)

func MangaScan() {
	mangasDir, err := os.ReadDir(config.Settings.MangasDirectory)
	if err != nil {
		panic(err)
	}

	sort.Slice(mangasDir, func(i, j int) bool {
		iInfo, _ := mangasDir[i].Info()
		jInfo, _ := mangasDir[j].Info()

		iTime := time.Since(iInfo.ModTime())
		jTime := time.Since(jInfo.ModTime())

		return iTime > jTime
	})

	for mangaIndex, mangaFolder := range mangasDir {
		var mangaId string

		mangaName := mangaFolder.Name()
		mangaFromDb := findMangaWithName(mangaName)
		manga := models.NewMangaSchema()

		manga.Details.Index = mangaIndex

		if mangaFromDb != nil {
			mangaId = mangaFromDb.ObjectId()
		} else {
			manga.Name = mangaName
			detailsJson, err := os.ReadFile(path.Join(config.Settings.MangasDirectory, mangaName, "details.json"))
			if err != nil && !errors.Is(err, os.ErrNotExist) {
				panic(err)
			}
			if errors.Is(err, os.ErrNotExist) {
				manga.Details.Title = mangaName
			} else {
				details := new(models.MangaJson)
				err = json.Unmarshal(detailsJson, details)
				if err != nil {
					panic(err)
				}
				details.Status = strings.ToUpper(details.Status)
				manga.Details.MangaJson = *details
			}

			// Add manga to Database
			mangaId = addMangaToDatabase(manga)

			updateChapters(mangaId)
		}

		// append if dbRecord does not exist
		if !slices.Contains(dbRecords.Ids, mangaId) {
			dbRecords.Ids = append(dbRecords.Ids, mangaId)
		}
	}
}

func updateChapters(mangaId string) {
	manga, err := database.FindById(MangaCollection, mangaId)
	if err != nil {
		return
	}

	mangaName := manga.Get("name").(string)

	mangaDetails := new(models.MangaModel)

	err = mapstructure.Decode(manga.Get("details"), mangaDetails)
	if err != nil {
		panic(err)
	}
	mangaIndex := mangaDetails.Index

	chapters := openChapDetails(mangaName)

	chapterIdList := make([]string, 0)

	for chapterIndex, chapter := range chapters {
		chapterSchema := new(models.ChapterSchema)
		chapterSchema.Name = chapter.Title
		chapterSchema.MangaId = mangaId
		chapterSchema.Details.Index = chapterIndex
		chapterSchema.Details.MangaIndex = mangaIndex
		chapterSchema.Details.Name = chapter.Title
		chapterSchema.Details.UploadDate = chapter.Date

		cbzFiles := openChapterCBZ(path.Join(config.Settings.MangasDirectory, mangaName, chapter.Title+".cbz"))
		if cbzFiles != nil {
			chapterSchema.Available = true
			chapterSchema.Details.PageCount = len(cbzFiles)
		}

		mangaChapterQuery := query.NewQuery("chapters").
			Where(query.Field("mangaId").Eq(mangaId).
				And(query.Field("name").Eq(chapter.Title)))
		chapterQueryRes, err := database.FindFirst(mangaChapterQuery)
		if err != nil {
			panic(err)
		}
		if chapterQueryRes == nil {
			chapterId := addChapter(chapterSchema)
			chapterIdList = append(chapterIdList, chapterId)
		}
	}

	err = database.UpdateById(MangaCollection, mangaId, func(doc *document.Document) *document.Document {
		_chapter := doc.Get("chapters").([]interface{})
		for _, _chapterId := range chapterIdList {
			_chapter = append(_chapter, _chapterId)
		}
		doc.Set("chapters", _chapter)
		return doc
	})
	if err != nil {
		panic(err)
	}
}

func openChapDetails(mangaName string) []models.ChapterJson {
	chapters := make([]models.ChapterJson, 0)
	chaptersJson, err := os.ReadFile(path.Join(config.Settings.MangasDirectory, mangaName, "chapters.json"))
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		panic(err)
	}

	chaptersDir, err := os.ReadDir(path.Join(config.Settings.MangasDirectory, mangaName))

	if errors.Is(err, os.ErrNotExist) {
		for _, chapter := range chaptersDir {
			if strings.HasPrefix(chapter.Name(), "cover") ||
				strings.HasSuffix(chapter.Name(), ".json") ||
				!strings.HasSuffix(chapter.Name(), ".cbz") {
				continue
			}

			chapterDetail := models.ChapterJson{
				Title: strings.ReplaceAll(chapter.Name(), ".cbz", ""),
				Date:  time.Now().UnixMilli(),
			}

			chapters = append(chapters, chapterDetail)
		}
	} else {
		err = json.Unmarshal(chaptersJson, &chapters)
		if err != nil {
			panic(err)
		}
	}

	return chapters
}

func openChapterCBZ(zipPath string) []*zip.File {
	zipFile, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil
	}

	filteredZip := make([]*zip.File, 0)

	for _, file := range zipFile.File {
		if !strings.HasSuffix(file.Name, ".xml") {
			filteredZip = append(filteredZip, file)
		}
	}

	return filteredZip
}

func GetMangaDetails(id string) *models.MangaModel {
	mangaDoc, err := database.FindById(MangaCollection, id)
	if err != nil {
		panic(err)
	}

	mangaDetails := new(models.MangaModel)

	err = mapstructure.Decode(mangaDoc.Get("details"), &mangaDetails)
	err = mapstructure.Decode(mangaDoc.Get("details"), &mangaDetails.MangaJson)

	mangaDetails.ThumbnailUrl = fmt.Sprintf("/api/v1/manga/%d/thumbnail", mangaDetails.Index)
	if err != nil {
		panic(err)
	}

	return mangaDetails
}

func GetMangaChapters(id string) []*models.ChapterModel {
	updateChapter(id)

	chaptersQuery := query.NewQuery("chapters").
		Where(query.Field("mangaId").Eq(id)).Sort(query.SortOption{Field: "name", Direction: -1})
	chaptersRaw, err := database.FindAll(chaptersQuery)
	if err != nil {
		return nil
	}

	chapters := make([]*models.ChapterModel, 0)
	for _, chapterRaw := range chaptersRaw {
		chapter := new(models.ChapterModel)
		err = mapstructure.Decode(chapterRaw.Get("details"), &chapter.ChapterModelEssential)
		if err != nil {
			panic(err)
		}
		if chapterRaw.Get("available").(bool) {
			chapters = append(chapters, chapter)
		}
	}

	return chapters
}

func GetMangaChapter(mangaId string, chapterIndex int) *models.ChapterModel {
	mangaDoc, err := database.FindById(MangaCollection, mangaId)
	if err != nil {
		panic(err)
	}

	chapters := mangaDoc.Get("chapters").([]interface{})

	if chapterIndex >= len(chapters) {
		return nil
	}

	chapterId := chapters[chapterIndex].(string)
	chapterDoc, err := database.FindById(ChapterCollection, chapterId)
	if err != nil {
		panic(err)
	}

	if !chapterDoc.Get("available").(bool) {
		return nil
	}

	chapterEssential := new(models.ChapterModelEssential)
	err = mapstructure.Decode(chapterDoc.Get("details"), chapterEssential)
	if err != nil {
		panic(err)
	}

	chapter := new(models.ChapterModel)
	chapter.ChapterModelEssential = *chapterEssential

	return chapter
}

func GetMangaThumbnail(id string) ([]byte, string) {
	manga, err := database.FindById("mangas", id)
	if err != nil {
		return nil, ""
	}

	mangaName := manga.Get("name").(string)

	dir, err := os.ReadDir(path.Join(config.Settings.MangasDirectory, mangaName))
	if err != nil {
		return nil, ""
	}

	var thumbnail []byte
	var contentType string

	for _, file := range dir {
		if strings.Contains(file.Name(), "cover") {
			thumbnail, err = os.ReadFile(path.Join(config.Settings.MangasDirectory, mangaName, file.Name()))
			if err != nil {
				return nil, ""
			}
			contentType = "image/" + strings.ReplaceAll(filepath.Ext(file.Name()), ".", "")
		}
	}

	return thumbnail, contentType
}

func GetPage(manga, chapter string, pageIndex int) ([]byte, string) {
	chapterZip, err := zip.OpenReader(path.Join(config.Settings.MangasDirectory, manga, chapter+".cbz"))
	if err != nil {
		return nil, ""
	}

	pages := make([]*zip.File, 0)
	for _, file := range chapterZip.File {
		if !strings.HasSuffix(file.Name, ".xml") {
			pages = append(pages, file)
		}
	}

	pageRaw := pages[pageIndex]

	page, err := pageRaw.Open()
	if err != nil {
		return nil, ""
	}
	pageImg, err := io.ReadAll(page)
	if err != nil {
		return nil, ""
	}

	return pageImg, "image/" + strings.ReplaceAll(filepath.Ext(pageRaw.Name), ".", "")
}

//func getChapterWithId(id string) *models.ChapterSchema {
//	chapterDoc, err := database.FindById(ChapterCollection, id)
//	if err != nil {
//		return nil
//	}
//
//	chapter := new(models.ChapterSchema)
//
//	err = chapterDoc.Unmarshal(chapter)
//	if err != nil {
//		panic(err)
//	}
//
//	return chapter
//}

func findMangaWithName(name string) *document.Document {
	mangaQuery := query.NewQuery(MangaCollection).Where(query.Field("name").Eq(name))

	mangaRaw, err := database.FindFirst(mangaQuery)
	if err != nil {
		panic(err)
	}

	return mangaRaw
}

func addMangaToDatabase(manga *models.MangaSchema) string {
	if findMangaWithName(manga.Name) != nil {
		panic("this should not happen")
	}

	mangaDoc := document.NewDocument()
	mangaDoc.SetAll(structToMapString(*manga))
	id, err := database.InsertOne(MangaCollection, mangaDoc)
	if err != nil {
		panic(err)
	}
	return id
}

func addChapter(chapter *models.ChapterSchema) string {
	chapterDoc := document.NewDocument()
	chapterDoc.SetAll(structToMapString(*chapter))
	id, err := database.InsertOne(ChapterCollection, chapterDoc)
	if err != nil {
		panic(err)
	}
	return id
}

func updateChapter(mangaId string) {
	manga, err := database.FindById(MangaCollection, mangaId)
	if err != nil {
		panic(err)
	}

	for _, chapterRaw := range manga.Get("chapters").([]interface{}) {
		chapterId := chapterRaw.(string)
		err = database.UpdateById(ChapterCollection, chapterId, func(chapterDoc *document.Document) *document.Document {
			chapterName := chapterDoc.Get("name").(string) + ".cbz"
			chapterPath := filepath.Join(config.Settings.MangasDirectory, manga.Get("name").(string), chapterName)
			_, err = os.Stat(filepath.Join(config.Settings.MangasDirectory, manga.Get("name").(string), chapterName))
			if err == nil {
				chapterDoc.Set("available", true)
				details := new(models.ChapterModelEssential)
				err := mapstructure.Decode(chapterDoc.Get("details"), details)
				if err != nil {
					panic(err)
				}

				cbzFiles := openChapterCBZ(chapterPath)

				details.PageCount = len(cbzFiles)

				chapterDoc.Set("details", details)
			} else {
				chapterDoc.Set("available", false)
			}
			return chapterDoc
		})
		if err != nil {
			panic(err)
		}

	}
	if err != nil {
		return
	}
}
