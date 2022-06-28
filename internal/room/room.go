package room

import (
	"log"
	"net/http"

	"github.com/turtlearmy/online-whiteboard/internal/canvas"
	"github.com/turtlearmy/online-whiteboard/internal/comm"
)

type Room struct {
	currentCanvas *canvas.Canvas
	incomingConn  chan *comm.Message
	users         *comm.UserManager
}

func New() *Room {
	room := &Room{
		canvas.NewWhiteCanvas(canvas.Height, canvas.Width),
		make(chan *comm.Message, 20),
		comm.NewUserManager(),
	}

	go func() {
		for msg := range room.incomingConn {
			broadcast, err := msg.Packet.Apply(room.currentCanvas, room.users, msg.Sender)
			if err != nil {
				log.Printf("error applying packet: %v\n", err)
			}
			if broadcast {
				room.users.BroadcastFrom(msg.Packet, msg.Sender)
			}
		}
	}()

	return room
}

func (room *Room) WsHandler(writer http.ResponseWriter, req *http.Request, session string) {
	conn, err := room.users.AddConnection(writer, req, session, room.incomingConn)
	if err != nil {
		log.Printf("error adding websocket connection: %v\n", err)
		return
	}
	packet, err := comm.NewPaintLayerSetPacket(room.currentCanvas, comm.ServerUserId)
	if err != nil {
		log.Printf("error initializing layer for new connection: %v\n", err)
		return
	}
	if err := conn.Broadcast(packet); err != nil {
		log.Printf("error initializing layer for new connection: %v\n", err)
		return
	}
}
