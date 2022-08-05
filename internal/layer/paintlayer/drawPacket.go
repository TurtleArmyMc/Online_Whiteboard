package paintlayer

import (
	"encoding/json"

	"github.com/turtlearmy/online-whiteboard/internal/c2s"
	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/layer/paintlayer/canvas"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

const packet_type_paint_layer_draw = "paint_layer_draw"

type DrawPacket struct {
	Pos   canvas.Pos     `json:"pos"`
	Image canvas.Encoded `json:"image"`
	Layer layer.Id       `json:"layer"`
}

var _ = c2s.Register(packet_type_paint_layer_draw, func() layer.Handler { return &DrawPacket{} })

func (packet *DrawPacket) PacketType() string {
	return packet_type_paint_layer_draw
}

func (packet *DrawPacket) Handle(layers *layer.Manager, users *user.Manager, sender user.Id) (user.OutgoingPacket, error) {
	paintLayer, _, err := layer.GetOwnedOfType[*paintLayer](layers, packet.Layer, sender, "paint on")
	if err != nil {
		return nil, err
	}
	image, err := packet.Image.Decode()
	if err != nil {
		return nil, err
	}
	if err := paintLayer.canvas.Draw(packet.Pos, image); err != nil {
		return nil, err
	}
	return packet, nil
}

func (packet *DrawPacket) Encoded() ([]byte, error) {
	return json.Marshal(map[string]interface{}{"type": packet_type_paint_layer_draw, "data": packet})
}
