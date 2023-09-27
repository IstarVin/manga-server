package config

import "os"

func chainCreateDir(dir string) {
	err := os.MkdirAll(dir, 0664)
	if err != nil {
		panic(err)
	}
}
