package main

import (
	"encoding/json"
	"flag"
	"manga-server/config"
	"manga-server/database"
	"manga-server/server"
	"os"
	"path"
	"reflect"
)

func init() {
	config.Init()
	database.Init()
}

func main() {
	flag.StringVar(&config.Settings.DataDirectory, "dir", config.DefaultConfig.DataDirectory, "Set Data Directory")
	flag.StringVar(&config.Settings.Host, "host", config.DefaultConfig.Host, "Set Host")
	flag.IntVar(&config.Settings.Port, "port", config.DefaultConfig.Port, "Set Data Directory")
	flag.StringVar(&config.Settings.MangasDirectory, "local", config.DefaultConfig.MangasDirectory, "Set manga directory")

	// check if something changed in config
	_, err := os.Stat(path.Join(config.Settings.DataDirectory, "config.json"))
	if !reflect.DeepEqual(config.Settings, config.DefaultConfig) || err != nil {
		// Save config.json
		configMarshal, err := json.MarshalIndent(config.Settings, "", "  ")
		if err != nil {
			panic(err)
		}
		err = os.WriteFile(path.Join(config.Settings.DataDirectory, "config.json"), configMarshal, os.ModePerm)
		if err != nil {
			panic(err)
		}
	}

	err = server.Start()
	if err != nil {
		panic(err)
	}
}
