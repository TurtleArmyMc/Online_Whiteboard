package layer

import "github.com/turtlearmy/online-whiteboard/internal/user"

type Id uint
type Type string

type Layer interface {
	LayerType() Type
	InitPacket() user.OutgoingPacket
	Id() Id
	Owner() user.Id
}

type Handler interface {
	Handle(*Manager, *user.Manager, user.Id) (broadcast bool, err error)
}
