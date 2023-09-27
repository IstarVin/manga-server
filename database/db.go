package database

import (
	"github.com/ostafen/clover/v2"
	"github.com/pkg/errors"
	"manga-server/config"
)

var database *clover.DB
var dbRecords *Records

const (
	MangaCollection   = "mangas"
	ChapterCollection = "chapters"
)

// temp
var databaseDir = "C:\\Users\\AJ\\Desktop\\test"

func Init() {
	var err error
	database, err = clover.Open(config.Settings.DataDirectory)
	if err != nil {
		panic(err)
	}

	err = database.CreateCollection(MangaCollection)
	if err != nil && !errors.Is(err, clover.ErrCollectionExist) {
		panic(err)
	}

	err = database.CreateCollection(ChapterCollection)
	if err != nil && !errors.Is(err, clover.ErrCollectionExist) {
		panic(err)
	}

	dbRecords = &Records{Ids: make([]string, 0)}

	MangaScan()
}

type Records struct {
	Ids []string
}

func GetMangaId(index int) string {
	return dbRecords.Ids[index]
}

func GetMangaListLength() int {
	return len(dbRecords.Ids)
}
