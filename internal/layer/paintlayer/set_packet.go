package paintlayer

import (
	"fmt"

	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/layer/paintlayer/canvas"
	"github.com/turtlearmy/online-whiteboard/internal/packets"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

const packet_type_paint_layer_set = "paint_layer_set"

type SetPacket struct {
	Image   canvas.Encoded `json:"image"`
	LayerId layer.Id       `json:"layer"`
}

var _ = packets.Register(packet_type_paint_layer_set, func() packets.Packet { return &SetPacket{} })

func (packet *SetPacket) PacketType() string {
	return packet_type_paint_layer_set
}

func (packet *SetPacket) Handle(layers *layer.Manager, users *user.Manager, sender user.Id) (broadcast bool, err error) {
	l := layers.Get(packet.LayerId)
	if l.Owner() != sender {
		return false, fmt.Errorf("user %d attempted set contents of layer owned by user %d", sender, l.Owner())
	}
	paintLayer, ok := l.(*paint_layer)
	if !ok {
		return false, fmt.Errorf("can not paint on layer of type '%s'", l.LayerType())
	}

	image, err := packet.Image.Decode()
	if err != nil {
		return false, err
	}
	if err := paintLayer.canvas.Draw(canvas.Pos{X: 0, Y: 0}, image); err != nil {
		return false, err
	}
	return true, nil
}
