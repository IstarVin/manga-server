package database

import (
	"fmt"
	"github.com/ostafen/clover/v2"
	"github.com/ostafen/clover/v2/document"
	"github.com/ostafen/clover/v2/query"
	"manga-server/config"
	"manga-server/models"
	"testing"
)

func TestDatabase(t *testing.T) {
	dbPath := "C:\\Users\\AJ\\Desktop\\test"

	db, err := clover.Open(dbPath)
	if err != nil {
		panic(err)
	}

	//err = db.CreateCollection("Alvin")
	//if err != nil {
	//	panic(err)
	//}

	mangaData := &models.MangaSchema{
		Name:     "alvin jay",
		Details:  &models.MangaModel{},
		Chapters: make([]string, 0),
	}

	docs := document.NewDocument()
	docs.Set("name", mangaData.Name)
	docs.Set("details", mangaData.Details)
	docs.Set("chapters", mangaData.Chapters)

	//one, err := db.InsertOne("Alvin", docs)
	//if err != nil {
	//	panic(err)
	//}
	//println(one)

	err = db.ExportCollection("Alvin", dbPath+"\\asd.json")
	if err != nil {
		panic(err)
	}

	all, err := db.FindAll(query.NewQuery("Alvin").Where(query.Field("name").Eq("alvin jay")))
	if err != nil {
		panic(err)
	}
	fmt.Println(len(all))

	asd := findMangaWithName("alvin jay")
	fmt.Println(asd)

	collections, err := db.ListCollections()
	if err != nil {
		panic(err)
	}

	fmt.Println(collections)
}

func TestManga(t *testing.T) {
	Init()
	docs := document.NewDocument()
	data := models.MangaSchema{
		Name:     "alvin jay",
		Details:  &models.MangaModel{},
		Chapters: make([]string, 0),
	}
	docs.SetAll(structToMapString(data))
	_, err := database.InsertOne("mangas", docs)
	if err != nil {
		panic(err)
	}
	asd := findMangaWithName("alvin jay")
	mangaasd := new(models.MangaSchema)
	_ = asd.Unmarshal(mangaasd)
	fmt.Println(mangaasd.Details)
	err = database.ExportCollection("mangas", databaseDir+"\\asd.json")
	if err != nil {
		panic(err)
	}
}

func TestMangaScan(t *testing.T) {
	config.Init()
	Init()
	//fmt.Println(GetMangaDetails(dbRecords.Ids[0]))
	database.ExportCollection("mangas", databaseDir+"\\asd.json")
	database.ExportCollection("chapters", databaseDir+"\\asd1.json")
}
