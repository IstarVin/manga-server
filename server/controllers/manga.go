package controllers

import (
	"github.com/gin-gonic/gin"
	"manga-server/database"
	"net/http"
	"strconv"
)

func GetManga(c *gin.Context) {
	mangaId := c.MustGet("mangaId").(string)

	c.JSON(http.StatusOK, database.GetMangaDetails(mangaId))
}

func GetChapters(c *gin.Context) {
	mangaId := c.MustGet("mangaId").(string)

	c.JSON(http.StatusOK, database.GetMangaChapters(mangaId))
}

func GetThumbnail(c *gin.Context) {
	mangaId := c.MustGet("mangaId").(string)
	mangaThumbnail, contentType := database.GetMangaThumbnail(mangaId)
	if mangaThumbnail == nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	c.Data(http.StatusOK, contentType, mangaThumbnail)
}

func GetChapterInfo(c *gin.Context) {
	mangaId := c.MustGet("mangaId").(string)
	chapterIndexStr := c.Param("chapterIndex")
	chapterIndex, err := strconv.Atoi(chapterIndexStr)
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	chapter := database.GetMangaChapter(mangaId, chapterIndex)
	if chapter == nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	c.JSON(http.StatusOK, chapter)
}

func GetPage(c *gin.Context) {
	mangaId := c.MustGet("mangaId").(string)
	chapterIndexStr := c.Param("chapterIndex")
	chapterIndex, err := strconv.Atoi(chapterIndexStr)
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	pageIndexStr := c.Param("pageIndex")
	pageIndex, err := strconv.Atoi(pageIndexStr)
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	chapter := database.GetMangaChapter(mangaId, chapterIndex)

	mangaName := database.GetMangaDetails(mangaId).Title
	chapterName := chapter.Name

	page, contentType := database.GetPage(mangaName, chapterName, pageIndex)

	c.Data(http.StatusOK, contentType, page)
}

func MangaValidate(c *gin.Context) {
	mangaIndex := c.Param("mangaIndex")

	if mangaIndex != "" {
		mangaIndexInt, err := strconv.Atoi(mangaIndex)
		if err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}

		if mangaIndexInt >= database.GetMangaListLength() || mangaIndexInt < 0 {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}

		mangaId := database.GetMangaId(mangaIndexInt)

		c.Set("mangaId", mangaId)
	}
}
