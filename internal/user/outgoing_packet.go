package user

import "encoding/json"

type OutgoingPacket interface {
	PacketType() string
}

func serializePacket(p OutgoingPacket) ([]byte, error) {
	return json.Marshal(
		map[string]interface{}{
			"type": p.PacketType(),
			"data": p,
		})
}
