package layerpackets

import "github.com/turtlearmy/online-whiteboard/internal/layer"

const c2s_packet_type_set_height = "s2c_set_layer_height"

type s2cSetLayerHeightPacket struct {
	Layer  layer.Id `json:"layer"`
	Height int      `json:"height"`
}

func (s2cSetLayerHeightPacket) PacketType() string {
	return c2s_packet_type_set_height
}
