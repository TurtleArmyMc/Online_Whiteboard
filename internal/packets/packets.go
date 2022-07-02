package packets

import (
	"encoding/json"
	"fmt"
)

var registry = map[string]func() Packet{}

type rawMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

func Register(packetType string, constructor func() Packet) error {
	registry[packetType] = constructor
	return nil
}

func Deserialize(rawData []byte) (Packet, error) {
	var msg rawMessage
	if err := json.Unmarshal(rawData, &msg); err != nil {
		return nil, err
	}
	packetType, ok := registry[msg.Type]
	if !ok {
		return nil, fmt.Errorf("unknown packet type '%s'", msg.Type)
	}
	packet := packetType()
	if err := json.Unmarshal(msg.Data, packet); err != nil {
		return nil, err
	}
	return packet, nil
}
