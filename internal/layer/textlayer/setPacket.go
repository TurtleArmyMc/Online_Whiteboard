package textlayer

import (
	"fmt"

	"github.com/turtlearmy/online-whiteboard/internal/c2s"
	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

const packet_type_text_layer_set = "text_layer_set"

type setPacket struct {
	Text    textInfo `json:"text"`
	LayerId layer.Id `json:"layer"`
}

var _ = c2s.Register(packet_type_text_layer_set, func() layer.Handler { return &setPacket{} })

func (*setPacket) PacketType() string {
	return packet_type_text_layer_set
}

func (packet *setPacket) Handle(layers *layer.Manager, users *user.Manager, sender user.Id) (user.OutgoingPacket, error) {
	l := layers.Get(packet.LayerId)
	if l.Owner() != sender {
		return nil, fmt.Errorf("user %d attempted to set contents of layer owned by user %d", sender, l.Owner())
	}

	textLayer, ok := l.(*textLayer)
	if !ok {
		return nil, fmt.Errorf("can not set text for layer of type '%s'", l.LayerType())
	}
	textLayer.Text = packet.Text

	return packet, nil
}
