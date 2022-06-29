package room

import (
	"log"
	"net/http"

	"github.com/turtlearmy/online-whiteboard/internal/canvas"
	"github.com/turtlearmy/online-whiteboard/internal/comm"
)

type Room struct {
	currentCanvas    *canvas.Canvas
	newConnections   chan *comm.Connection
	incomingMessages chan *comm.Message
	users            *comm.UserManager
	open             bool
}

func New() *Room {
	room := &Room{
		canvas.NewWhiteCanvas(canvas.Height, canvas.Width),
		make(chan *comm.Connection, 3),
		make(chan *comm.Message, 20),
		comm.NewUserManager(),
		true,
	}

	go room.handleEvents()

	return room
}

func (room *Room) handleEvents() {
	for room.open {
		select {
		case conn := <-room.newConnections:
			if err := room.setupNewConnection(conn); err != nil {
				if err != nil {
					log.Printf("error setting up new connection: %v\n", err)
				}
			}
		case msg := <-room.incomingMessages:
			broadcast, err := msg.Packet.Apply(room.currentCanvas, room.users, msg.Sender)
			if err != nil {
				log.Printf("error applying packet: %v\n", err)
			}
			if broadcast {
				room.users.BroadcastFrom(msg.Packet, msg.Sender)
			}
		}
	}
}

func (room *Room) setupNewConnection(conn *comm.Connection) error {
	packet, err := comm.NewPaintLayerSetPacket(room.currentCanvas)
	if err != nil {
		return err
	}
	if err := conn.Broadcast(packet); err != nil {
		return err
	}
	return nil
}

func (room *Room) WsHandler(writer http.ResponseWriter, req *http.Request, session comm.Session) {
	conn, err := room.users.AddConnection(writer, req, session, room.incomingMessages)
	if err != nil {
		log.Printf("error adding websocket connection: %v\n", err)
		return
	}
	room.newConnections <- conn
}
