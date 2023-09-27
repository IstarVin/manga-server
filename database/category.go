package database

import (
	"manga-server/models"
)

func GetCategory(categoryIndex int) []*models.MangaModel {
	MangaScan()
	mangas := make([]*models.MangaModel, 0)
	for _, mangaId := range dbRecords.Ids {
		manga := GetMangaDetails(mangaId)
		mangas = append(mangas, manga)
	}

	return mangas
}
