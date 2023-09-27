package server

import (
	"manga-server/config"
	"manga-server/database"
	"testing"
)

func TestApi(t *testing.T) {
	config.Init()
	database.Init()
	err := Start()
	if err != nil {
		panic(err)
	}
}
