package room

import (
	"github.com/turtlearmy/online-whiteboard/internal/packets"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

type message struct {
	Packet packets.Packet
	Sender user.Connection
}
