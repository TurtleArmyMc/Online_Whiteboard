package paintlayer

import (
	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/layer/paintlayer/canvas"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

const LAYER_TYPE layer.Type = "paint_layer"

type paint_layer struct {
	canvas canvas.Canvas
	id     layer.Id
	owner  user.Id
}

func NewPaintLayer(id layer.Id, owner user.Id) layer.Layer {
	return &paint_layer{canvas.NewTransparent(canvas.Width, canvas.Height), id, owner}
}

var _ = layer.Register(LAYER_TYPE, NewPaintLayer)

func (l *paint_layer) LayerType() layer.Type {
	return LAYER_TYPE
}

func (l *paint_layer) InitPacket() user.OutgoingPacket {
	return &setPacket{l.canvas.Encode(), l.id}
}

func (l *paint_layer) Id() layer.Id {
	return l.id
}

func (l *paint_layer) Owner() user.Id {
	return l.owner
}
