package layerpackets

import (
	"fmt"

	"github.com/turtlearmy/online-whiteboard/internal/c2s"
	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

const packet_type_layer_delete = "delete_layer"

type deletePacket layer.Id

var _ = c2s.Register(packet_type_layer_delete, func() layer.Handler { return new(deletePacket) })

func (deletePacket) PacketType() string {
	return packet_type_layer_delete
}

func (deleteLayerId deletePacket) Handle(layers *layer.Manager, users *user.Manager, sender user.Id) (user.OutgoingPacket, error) {
	l := layers.Get(layer.Id(deleteLayerId))
	if l.Owner() != sender {
		return nil, fmt.Errorf("user %d attempted to delete layer owned by user %d", sender, l.Owner())
	}
	layers.Remove(layer.Id(deleteLayerId))

	return deleteLayerId, nil
}
