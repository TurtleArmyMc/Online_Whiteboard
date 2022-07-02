package canvas

import "encoding/base64"

type Encoded struct {
	Data   string `json:"data"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

func (encoded *Encoded) Decode() (Canvas, error) {
	image, err := base64.StdEncoding.DecodeString(encoded.Data)
	if err != nil {
		return Canvas{}, err
	}
	return New(image, encoded.Width, encoded.Height)
}

func (src *Canvas) Encode() Encoded {
	return Encoded{base64.StdEncoding.EncodeToString(src.Data), src.Width, src.Height}
}
