package canvas

import "errors"

type Canvas struct {
	Data   []byte
	Width  int
	Height int
}

const (
	Height = 1920
	Width  = 1080
)

func New(data []byte, width, height int) (Canvas, error) {
	if len(data) != width*height*4 {
		return Canvas{}, errors.New("canvas data length does not match width and height")
	}
	return Canvas{data, width, height}, nil
}

func NewWhite(width, height int) Canvas {
	data := make([]byte, width*height*4)
	for i := range data {
		data[i] = 0xFF
	}
	return Canvas{data, width, height}
}

func NewTransparent(width, height int) Canvas {
	return Canvas{make([]byte, width*height*4), width, height}
}

func (dst *Canvas) Draw(pos Pos, src Canvas) error {
	if !pos.Positive() || pos.X+src.Width > dst.Width || pos.Y+src.Height > dst.Height {
		return errors.New("draw is out of bounds")
	}

	srcByteWidth := src.Width * 4
	dstByteWidth := dst.Width * 4
	for rSrc := 0; rSrc < src.Height; rSrc++ {
		rDst := rSrc + pos.Y
		rowSrc := src.Data[rSrc*srcByteWidth : (rSrc+1)*srcByteWidth]
		rowDst := dst.Data[rDst*dstByteWidth+pos.X*4:]
		copy(rowDst, rowSrc)
	}

	return nil
}

func (dst *Canvas) SetData(data []byte) error {
	if len(data) != dst.Width*dst.Height*4 {
		return errors.New("canvas data does not match dimensions")
	}
	copy(dst.Data, data)
	return nil
}
