package user

import "encoding/json"

type OutgoingPacket interface {
	PacketType() string
}

func SerializePacket(p OutgoingPacket) ([]byte, error) {
	return json.Marshal(
		map[string]interface{}{
			"type": p.PacketType(),
			"data": p,
		})
}
