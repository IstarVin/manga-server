package models

type CategorySchema struct {
	Id string

	Details CategoryModel
}

type CategoryModel struct {
	Index   int  `json:"id"`
	Order   int  `json:"order"`
	Name    int  `json:"name"`
	Default bool `json:"default"`
}
