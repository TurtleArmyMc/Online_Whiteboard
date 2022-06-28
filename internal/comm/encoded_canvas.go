package comm

import (
	"encoding/base64"

	"github.com/turtlearmy/online-whiteboard/internal/canvas"
)

type encodedCanvas struct {
	Data   string `json:"data"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

func (encoded *encodedCanvas) decode() (*canvas.Canvas, error) {
	image, err := base64.StdEncoding.DecodeString(encoded.Data)
	if err != nil {
		return nil, err
	}
	return canvas.NewCanvas(image, encoded.Width, encoded.Height)
}

func encodeCanvas(src *canvas.Canvas) *encodedCanvas {
	return &encodedCanvas{base64.StdEncoding.EncodeToString(src.Data), src.Width, src.Height}
}
