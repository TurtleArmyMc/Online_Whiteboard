package comm

import (
	"github.com/turtlearmy/online-whiteboard/internal/conn"
	"github.com/turtlearmy/online-whiteboard/internal/packet"
)

type Message struct {
	Packet packet.Packet
	Sender conn.Id
}
