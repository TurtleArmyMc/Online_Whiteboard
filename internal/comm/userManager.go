package comm

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/turtlearmy/online-whiteboard/internal/canvas"
	"github.com/turtlearmy/online-whiteboard/internal/conn"
	"github.com/turtlearmy/online-whiteboard/internal/packet"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

type UserManager struct {
	connections     map[conn.Id]*conn.Connection
	connIdGenerator conn.IdGenerator

	session2User    map[user.Session]user.Id
	userIdGenerator user.IdGenerator

	mu sync.RWMutex
}

func NewUserManager() *UserManager {
	return &UserManager{map[conn.Id]*conn.Connection{}, conn.IdGenerator{}, map[user.Session]user.Id{}, user.IdGenerator{}, sync.RWMutex{}}
}

func (users *UserManager) SessionToUserId(session user.Session) user.Id {
	users.mu.RLock()
	defer users.mu.RUnlock()
	return users.sessionToUserId(session)
}

// Caller must lock mutex
func (users *UserManager) sessionToUserId(session user.Session) user.Id {
	if userId, ok := users.session2User[session]; ok {
		return userId
	}
	userId := users.userIdGenerator.Next()
	users.session2User[session] = userId
	return userId
}

// Broadcasts data to everyone but the sender
func (users *UserManager) BroadcastFrom(packet packet.Packet, sender conn.Id) error {
	users.mu.Lock()
	defer users.mu.Unlock()

	encoded, err := packet.Encoded()
	if err != nil {
		return err
	}
	for id, c := range users.connections {
		if id != sender {
			c.Listener <- encoded
		}
	}

	return nil
}

func (users *UserManager) BroadcastTo(packet packet.Packet, receiver *conn.Connection) error {
	users.mu.Lock()
	defer users.mu.Unlock()

	encoded, err := packet.Encoded()
	if err != nil {
		return err
	}
	receiver.Listener <- encoded

	return nil

}

var wsupgrader = websocket.Upgrader{
	ReadBufferSize:  canvas.Height * canvas.Width * 10, // 1024,
	WriteBufferSize: canvas.Height * canvas.Width * 10, // 1024,

}

func (users *UserManager) AddConnection(writer http.ResponseWriter, req *http.Request, session user.Session, incomingListener chan *Message) (*conn.Connection, error) {
	ws, err := wsupgrader.Upgrade(writer, req, nil)
	if err != nil {
		return nil, err
	}

	outgoingListener := make(chan []byte, 10)

	users.mu.Lock()
	connId := users.connIdGenerator.Next()
	conn := &conn.Connection{Listener: outgoingListener, Id: connId, UserId: users.sessionToUserId(session)}
	users.connections[connId] = conn
	users.mu.Unlock()

	// Send outgoing messages
	go func() {
		for msg := range outgoingListener {
			ws.WriteMessage(websocket.TextMessage, msg)
		}
	}()

	// Read incoming messages
	go func() {
		for {
			t, msgData, err := ws.ReadMessage()
			if err != nil {
				break
			}
			if t == websocket.BinaryMessage {
				log.Printf("warning: received binary message `%s`", msgData)
			}
			if t == websocket.TextMessage {
				if packet, err := decode(msgData); err != nil {
					log.Printf("error decoding incoming packet: %v\n", err)
				} else {
					incomingListener <- &Message{packet, connId}
				}
			}
		}

		users.removeConnection(conn)
	}()

	return conn, nil
}

func (users *UserManager) removeConnection(c *conn.Connection) {
	users.mu.Lock()
	delete(users.connections, c.Id)
	users.mu.Unlock()
}
