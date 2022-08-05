package user

import (
	"fmt"
)

type Manager struct {
	sessions   map[Session]Id
	nextUserId Id

	connections map[connectionId]Connection
	nextConnId  connectionId

	names map[Id]string
}

func NewManager() *Manager {
	return &Manager{sessions: map[Session]Id{}, connections: map[connectionId]Connection{}, names: map[Id]string{}}
}

func (users *Manager) ForSession(session Session) Id {
	if u, ok := users.sessions[session]; ok {
		return u
	}

	users.nextUserId++ // Start ids at 1 and not 0
	users.sessions[session] = users.nextUserId
	return users.nextUserId
}

func (users *Manager) AddConnection(req ConnectionRequest) Connection {
	u := users.ForSession(req.session)

	users.nextConnId++ // Start ids at 1 and not 0
	id := users.nextConnId

	c := Connection{req.outgoing, u, id}

	users.connections[c.id] = c

	// Send connection handle to where the connection was created
	req.receiveConn <- c

	return c
}

func (users *Manager) RemoveConnection(c Connection) {
	delete(users.connections, c.id)
}

func (users *Manager) ConnectionCount() int {
	return len(users.connections)
}

func (users *Manager) Online(u Id) bool {
	for _, c := range users.connections {
		if u == c.User {
			return true
		}
	}
	return false
}

func (users *Manager) Name(user Id) string {
	if name, ok := users.names[user]; ok {
		return name
	}
	return fmt.Sprintf("Anonymous %d", user)
}

func (users *Manager) SetName(user Id, name string) {
	users.names[user] = name
}

func (users *Manager) SendToAll(packet OutgoingPacket) error {
	data, err := serializePacket(packet)
	if err != nil {
		return err
	}

	for _, connection := range users.connections {
		connection.outgoing <- data
	}
	return nil
}

// Broadcast packet to all but the sender
func (users *Manager) SendFrom(packet OutgoingPacket, sender Connection) error {
	data, err := serializePacket(packet)
	if err != nil {
		return err
	}

	for id, connection := range users.connections {
		if id != sender.id {
			connection.outgoing <- data
		}
	}
	return nil
}
