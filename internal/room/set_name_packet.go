package room

import (
	"fmt"

	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/packets"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

const packet_type_set_name = "set_name"

type SetNamePacket struct {
	Id   user.Id `json:"id"`
	Name string  `json:"name"`
}

var _ = packets.Register(packet_type_set_name, func() packets.Packet { return &SetNamePacket{} })

func (packet *SetNamePacket) PacketType() string {
	return packet_type_set_name
}

func (packet *SetNamePacket) Handle(layers *layer.Manager, users *user.Manager, sender user.Id) (broadcast bool, err error) {
	senderName := users.Name(sender)
	if packet.Id != sender {
		setName := users.Name(packet.Id)
		return false, fmt.Errorf(
			"user '%s' (id %d) attempted set name of user '%s' (id %d) to '%s'",
			senderName,
			sender,
			setName,
			packet.Id,
			packet.Name,
		)
	}
	if senderName == packet.Name {
		// Do nothing if name is the same
		return false, nil
	}
	users.SetName(sender, packet.Name)
	return true, nil
}
