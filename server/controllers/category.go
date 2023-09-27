package controllers

import (
	"github.com/gin-gonic/gin"
	"manga-server/database"
	"net/http"
)

func GetCategory(c *gin.Context) {
	//categoryIndexStr := c.Param("categoryIndex")
	//categoryIndex, err := strconv.Atoi(categoryIndexStr)
	//if err != nil {
	//	c.AbortWithStatus(http.StatusBadRequest)
	//	return
	//}
	categoryIndex := 0

	mangaList := database.GetCategory(categoryIndex)

	c.JSON(http.StatusOK, mangaList)
}
