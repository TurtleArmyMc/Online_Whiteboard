package layerpackets

import (
	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

const s2c_layer_create = "s2c_create_layer"

type s2cCreatePacket struct {
	LayerType layer.Type `json:"layer_type"`
	Id        layer.Id   `json:"id"`
	Owner     user.Id    `json:"owner"`
	Height    int        `json:"height"`
}

func (packet *s2cCreatePacket) PacketType() string {
	return s2c_layer_create
}

func NewS2CCreatePacket(layer layer.Layer, height int) user.OutgoingPacket {
	return &s2cCreatePacket{layer.LayerType(), layer.Id(), layer.Owner(), height}
}
