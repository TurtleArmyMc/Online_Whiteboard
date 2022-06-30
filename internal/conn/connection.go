package conn

import "github.com/turtlearmy/online-whiteboard/internal/user"

type Id uint

type Connection struct {
	Listener chan []byte
	Id       Id
	UserId   user.Id
}

type IdGenerator struct {
	nextId Id
}

func (gen *IdGenerator) Next() Id {
	gen.nextId++ // Start ids at 1 and not 0
	return gen.nextId
}
