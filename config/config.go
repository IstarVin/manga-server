package config

import (
	"os"
	"path/filepath"
)

type Config struct {
	Host string `json:"host"`
	Port int    `json:"port"`

	DataDirectory   string `json:"dataDirectory"`
	MangasDirectory string `json:"mangaDirectory"`
}

var Settings Config

var DefaultConfig = Config{
	Host:            "0.0.0.0",
	Port:            6969,
	DataDirectory:   ".",
	MangasDirectory: ".",
}

func Init() {
	configDir, err := os.UserConfigDir()
	if err != nil {
		panic(err)
	}
	DefaultConfig.DataDirectory = filepath.Join(configDir, "manga-server-aj")
	DefaultConfig.MangasDirectory = filepath.Join(DefaultConfig.DataDirectory, "local")

	chainCreateDir(DefaultConfig.DataDirectory)
	chainCreateDir(DefaultConfig.MangasDirectory)

	Settings = DefaultConfig
}
