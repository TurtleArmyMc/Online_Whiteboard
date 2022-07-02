package layer

import (
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

const PACKET_TYPE_LAYER_CREATE = "create_layer"

type outgoingCreatePacket struct {
	LayerType Type    `json:"layer_type"`
	Id        Id      `json:"id"`
	Owner     user.Id `json:"owner"`
	Height    int     `json:"height"`
}

func (packet *outgoingCreatePacket) PacketType() string {
	return PACKET_TYPE_LAYER_CREATE
}

func NewCreatePacket(layer Layer, height int) user.OutgoingPacket {
	return &outgoingCreatePacket{layer.LayerType(), layer.Id(), layer.Owner(), height}
}
