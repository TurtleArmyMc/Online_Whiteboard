package layer

import (
	"github.com/turtlearmy/online-whiteboard/internal/canvas"
)

type Layer struct {
	Canvas  canvas.Canvas
	OwnerId uint
}

func (layer *Layer) Draw(pos canvas.Pos, src canvas.Canvas) error {
	if err := layer.Canvas.Draw(pos, src); err != nil {
		return err
	}
	return nil
}
