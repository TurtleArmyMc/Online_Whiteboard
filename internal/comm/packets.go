package comm

import (
	"encoding/json"
	"fmt"

	"github.com/turtlearmy/online-whiteboard/internal/canvas"
	"github.com/turtlearmy/online-whiteboard/internal/conn"
	"github.com/turtlearmy/online-whiteboard/internal/packet"
)

const (
	TYPE_PAINT_LAYER_SET  = "paint_layer_set"
	TYPE_PAINT_LAYER_DRAW = "paint_layer_draw"
)

type rawMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

func decode(rawData []byte) (packet.Packet, error) {
	var msg rawMessage
	if err := json.Unmarshal(rawData, &msg); err != nil {
		return nil, err
	}
	packetType, ok := packetTypes[msg.Type]
	if !ok {
		return nil, fmt.Errorf("unknown packet type '%s'", msg.Type)
	}
	packet := packetType()
	if err := json.Unmarshal(msg.Data, packet); err != nil {
		return nil, err
	}
	return packet, nil
}

var packetTypes = map[string]func() packet.Packet{
	TYPE_PAINT_LAYER_SET: func() packet.Packet {
		return &paintLayerSetPacket{}
	},

	TYPE_PAINT_LAYER_DRAW: func() packet.Packet {
		return &paintLayerDrawPacket{}
	},
}

type paintLayerSetPacket struct {
	Image canvas.Encoded `json:"image"`
}

func (packet *paintLayerSetPacket) Apply(currentCanvas canvas.Canvas, sender conn.Id) (bool, error) {
	image, err := packet.Image.Decode()
	if err != nil {
		return false, err
	}
	if err := currentCanvas.Draw(canvas.Pos{X: 0, Y: 0}, image); err != nil {
		return false, err
	}
	return true, nil
}

func (packet *paintLayerSetPacket) Encoded() ([]byte, error) {
	return json.Marshal(map[string]interface{}{"type": TYPE_PAINT_LAYER_SET, "data": packet})
}

func NewPaintLayerSetPacket(currentCanvas canvas.Canvas) (packet.Packet, error) {
	return &paintLayerSetPacket{currentCanvas.Encode()}, nil
}

type paintLayerDrawPacket struct {
	Pos   canvas.Pos     `json:"pos"`
	Image canvas.Encoded `json:"image"`
}

func (packet *paintLayerDrawPacket) Apply(currentCanvas canvas.Canvas, sender conn.Id) (bool, error) {
	image, err := packet.Image.Decode()
	if err != nil {
		return false, err
	}
	if err := currentCanvas.Draw(packet.Pos, image); err != nil {
		return false, err
	}
	return true, nil
}

func (packet *paintLayerDrawPacket) Encoded() ([]byte, error) {
	return json.Marshal(map[string]interface{}{"type": TYPE_PAINT_LAYER_DRAW, "data": packet})
}
