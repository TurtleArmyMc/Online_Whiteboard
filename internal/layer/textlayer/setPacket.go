package textlayer

import (
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
	textLayer, _, err := layer.GetOwnedOfType[*textLayer](layers, packet.LayerId, sender, "set contents of")
	if err != nil {
		return nil, err
	}
	textLayer.Text = packet.Text
	return packet, nil
}
