package layerpackets

import (
	"github.com/turtlearmy/online-whiteboard/internal/layer"
)

const c2s_packet_type_layer_delete = "s2c_delete_layer"

type s2cDeletePacket layer.Id

func (s2cDeletePacket) PacketType() string {
	return c2s_packet_type_layer_delete
}
