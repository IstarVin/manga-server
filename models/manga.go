package models

// model -> api
// schema -> database

func NewMangaSchema() *MangaSchema {
	return &MangaSchema{
		Name:     "",
		Details:  new(MangaModel),
		Chapters: make([]string, 0),
	}
}

type MangaSchema struct {
	Name string `clover:"name"`

	Details  *MangaModel `clover:"details"`
	Chapters []string    `clover:"chapters"`
}

type MangaModel struct {
	Index int `json:"id" clover:"index"`

	Url          string `json:"url" clover:"url"`
	ThumbnailUrl string `json:"thumbnailUrl" clover:"thumbnailUrl"`

	MangaJson
}

type MangaJson struct {
	SourceId string `json:"sourceId"`
	Title    string `json:"title" clover:"title"`

	Artist      string   `json:"artist" clover:"artist"`
	Author      string   `json:"author" clover:"author"`
	Description string   `json:"description" clover:"description"`
	Genre       []string `json:"genre" clover:"genre"`
	Status      string   `json:"status" clover:"status"`
}
