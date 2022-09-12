package layer

import "github.com/turtlearmy/online-whiteboard/internal/user"

type Id uint
type Type string

type Layer interface {
	LayerType() Type
	InitPacket() user.OutgoingPacket
	Id() Id
	Owner() user.Id // Unowned layers have an owner of 0
	SetOwner(user user.Id)
}

type Handler interface {
	Handle(*Manager, *user.Manager, user.Id) (user.OutgoingPacket, error)
}

type LayerInfo struct {
	LayerId    Id
	LayerOwner user.Id
}

func (l *LayerInfo) Id() Id {
	return l.LayerId
}

func (l *LayerInfo) Owner() user.Id {
	return l.LayerOwner
}

func (l *LayerInfo) SetOwner(user user.Id) {
	l.LayerOwner = user
}
