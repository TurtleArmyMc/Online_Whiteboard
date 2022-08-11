package textlayer

import (
	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/layer/canvas"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

const LAYER_TYPE layer.Type = "text_layer"

type textLayer struct {
	Text  textInfo
	id    layer.Id
	owner user.Id
}

func newTextLayer(id layer.Id, owner user.Id) layer.Layer {
	return &textLayer{textInfo{canvas.Width / 2, canvas.Height / 2, 12, "Text"}, id, owner}
}

var _ = layer.Register(LAYER_TYPE, newTextLayer)

func (l *textLayer) LayerType() layer.Type {
	return LAYER_TYPE
}

func (l *textLayer) InitPacket() user.OutgoingPacket {
	return &setPacket{l.Text, l.id}
}

func (l *textLayer) Id() layer.Id {
	return l.id
}

func (l *textLayer) Owner() user.Id {
	return l.owner
}
