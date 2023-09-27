package server

import (
	"github.com/gin-gonic/gin"
	"manga-server/server/controllers"
)

func Start() error {
	engine := gin.Default()

	api := engine.Group("/api/v1")

	manga := api.Group("/manga/:mangaIndex", controllers.MangaValidate)
	{
		manga.GET("/", controllers.GetManga)
		manga.GET("/thumbnail", controllers.GetThumbnail)
		manga.GET("/chapters", controllers.GetChapters)
		manga.GET("/chapter/:chapterIndex", controllers.GetChapterInfo)
		manga.GET("/chapter/:chapterIndex/page/:pageIndex", controllers.GetPage)
	}

	category := api.Group("/category")
	{
		category.GET("/:categoryIndex", controllers.GetCategory)
	}

	api.GET("/0", controllers.GetCategory)

	return engine.Run()
}
