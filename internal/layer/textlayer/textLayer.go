package textlayer

import (
	"fmt"

	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/layer/canvas"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

const LAYER_TYPE layer.Type = "text_layer"

type textLayer struct {
	layer.LayerInfo
	Text textInfo
}

func newTextLayer(id layer.Id, owner user.Id) layer.Layer {
	return &textLayer{
		layer.LayerInfo{
			LayerId:    id,
			LayerOwner: owner,
			LayerName:  fmt.Sprintf("Text Layer %d", id),
		},
		textInfo{canvas.Width / 2, canvas.Height / 2, 30, "Text"},
	}
}

var _ = layer.Register(LAYER_TYPE, newTextLayer)

func (l *textLayer) LayerType() layer.Type {
	return LAYER_TYPE
}

func (l *textLayer) InitPacket() user.OutgoingPacket {
	return &setPacket{l.Text, l.Id()}
}
