package paintlayer

import (
	"fmt"

	"github.com/turtlearmy/online-whiteboard/internal/c2s"
	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/layer/paintlayer/canvas"
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
	l := layers.Get(packet.LayerId)
	if l.Owner() != sender {
		return nil, fmt.Errorf("user %d attempted to set contents of layer owned by user %d", sender, l.Owner())
	}
	paintLayer, ok := l.(*paintLayer)
	if !ok {
		return nil, fmt.Errorf("can not paint on layer of type '%s'", l.LayerType())
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
