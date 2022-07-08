package room

import (
	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

type message struct {
	Packet layer.Handler
	Sender user.Connection
}
