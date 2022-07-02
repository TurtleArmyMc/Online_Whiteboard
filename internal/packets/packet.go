package packets

import (
	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

type Packet interface {
	user.OutgoingPacket
	layer.Handler
}
