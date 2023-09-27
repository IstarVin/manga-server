package database

import "reflect"

func structToMapString(input interface{}) map[string]interface{} {
	result := make(map[string]interface{})

	// Use reflection to inspect the input
	value := reflect.ValueOf(input)
	typeOf := value.Type()

	// Iterate over the fields of the struct
	for i := 0; i < value.NumField(); i++ {
		index := value.NumField() - i - 1
		fieldName := typeOf.Field(index).Tag.Get("clover")
		fieldValue := value.Field(index).Interface()
		result[fieldName] = fieldValue
	}

	return result
}
