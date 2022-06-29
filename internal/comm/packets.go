package comm

import (
	"encoding/json"
	"fmt"

	"github.com/turtlearmy/online-whiteboard/internal/canvas"
)

type Packet interface {
	// Returns whether or not the packet should be broadcast to other connections
	Apply(currentCanvas *canvas.Canvas, users *UserManager, sender ConnId) (bool, error)
	encoded() ([]byte, error)
}

const (
	TYPE_PAINT_LAYER_SET  = "paint_layer_set"
	TYPE_PAINT_LAYER_DRAW = "paint_layer_draw"
)

type rawMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

func decode(rawData []byte) (Packet, error) {
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

var packetTypes = map[string]func() Packet{
	TYPE_PAINT_LAYER_SET: func() Packet {
		return &paintLayerSetPacket{}
	},

	TYPE_PAINT_LAYER_DRAW: func() Packet {
		return &paintLayerDrawPacket{}
	},
}

type paintLayerSetPacket struct {
	Image encodedCanvas `json:"image"`
}

func (packet *paintLayerSetPacket) Apply(currentCanvas *canvas.Canvas, users *UserManager, sender ConnId) (bool, error) {
	image, err := packet.Image.decode()
	if err != nil {
		return false, err
	}
	if err := currentCanvas.Draw(canvas.Pos{X: 0, Y: 0}, image); err != nil {
		return false, err
	}
	return true, nil
}

func (packet *paintLayerSetPacket) encoded() ([]byte, error) {
	return json.Marshal(map[string]interface{}{"type": TYPE_PAINT_LAYER_SET, "data": packet})
}

func NewPaintLayerSetPacket(currentCanvas *canvas.Canvas) (Packet, error) {
	return &paintLayerSetPacket{*encodeCanvas(currentCanvas)}, nil
}

type paintLayerDrawPacket struct {
	Pos   canvas.Pos    `json:"pos"`
	Image encodedCanvas `json:"image"`
}

func (packet *paintLayerDrawPacket) Apply(currentCanvas *canvas.Canvas, users *UserManager, sender ConnId) (bool, error) {
	image, err := packet.Image.decode()
	if err != nil {
		return false, err
	}
	if err := currentCanvas.Draw(packet.Pos, image); err != nil {
		return false, err
	}
	return true, nil
}

func (packet *paintLayerDrawPacket) encoded() ([]byte, error) {
	return json.Marshal(map[string]interface{}{"type": TYPE_PAINT_LAYER_DRAW, "data": packet})
}
