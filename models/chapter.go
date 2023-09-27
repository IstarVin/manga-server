package models

type ChapterSchema struct {
	Name      string `clover:"name"`
	MangaId   string `clover:"mangaId"`
	Available bool   `clover:"available"`

	Details ChapterModelEssential `clover:"details"`
}

type ChapterModel struct {
	ChapterModelEssential
	ChapterModelAddon
}

type ChapterModelEssential struct {
	Url           string  `json:"url" clover:"url"`
	Name          string  `json:"name" clover:"name"`
	UploadDate    int64   `json:"uploadDate" clover:"uploadDate"`
	ChapterNumber float32 `json:"chapterNumber" clover:"chapterNumber"`
	Scanlator     string  `json:"scanlator" clover:"scanlator"`
	MangaIndex    int     `json:"mangaId" clover:"mangaIndex"`
	Index         int     `json:"index"`
	PageCount     int     `json:"pageCount"`
}

type ChapterModelAddon struct {
	Read         bool `json:"read"`
	Bookmarked   bool `json:"bookmarked"`
	LastPageRead int  `json:"lastPageRead"`
	LastReadAt   int  `json:"lastReadAt"`
	Downloaded   bool `json:"downloaded"`
}

type ChapterJson struct {
	Title string `json:"title"`
	Date  int64  `json:"date"`
}
