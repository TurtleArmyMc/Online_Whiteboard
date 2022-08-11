package paintlayer

import (
	"github.com/turtlearmy/online-whiteboard/internal/c2s"
	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/layer/canvas"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

const packet_type_paint_layer_set = "paint_layer_set"

type setPacket struct {
	Image   canvas.Encoded `json:"image"`
	LayerId layer.Id       `json:"layer"`
}

var _ = c2s.Register(packet_type_paint_layer_set, func() layer.Handler { return &setPacket{} })

func (*setPacket) PacketType() string {
	return packet_type_paint_layer_set
}

func (packet *setPacket) Handle(layers *layer.Manager, users *user.Manager, sender user.Id) (user.OutgoingPacket, error) {
	paintLayer, _, err := layer.GetOwnedOfType[*paintLayer](layers, packet.LayerId, sender, "set contents of")
	if err != nil {
		return nil, err
	}
	image, err := packet.Image.Decode()
	if err != nil {
		return nil, err
	}
	if err := paintLayer.canvas.Draw(canvas.Pos{X: 0, Y: 0}, image); err != nil {
		return nil, err
	}
	return packet, nil
}
