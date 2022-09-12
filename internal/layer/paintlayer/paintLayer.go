package paintlayer

import (
	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/layer/canvas"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

const LAYER_TYPE layer.Type = "paint_layer"

type paintLayer struct {
	layer.LayerInfo
	canvas canvas.Canvas
}

func NewPaintLayer(id layer.Id, owner user.Id) layer.Layer {
	return &paintLayer{layer.LayerInfo{id, owner}, canvas.NewTransparent(canvas.Width, canvas.Height)}
}

var _ = layer.Register(LAYER_TYPE, NewPaintLayer)

func (l *paintLayer) LayerType() layer.Type {
	return LAYER_TYPE
}

func (l *paintLayer) InitPacket() user.OutgoingPacket {
	return &setPacket{l.canvas.Encode(), l.Id()}
}
