package user

// Used to identify connections. This id is not shared with clients
type connectionId uint

type Connection struct {
	outgoing chan<- []byte
	User     Id
	id       connectionId
}

func (c *Connection) Send(packet OutgoingPacket) error {
	data, err := serializePacket(packet)
	if err != nil {
		return err
	}
	c.outgoing <- data
	return nil
}

type ConnectionRequest struct {
	outgoing    chan<- []byte
	session     Session
	receiveConn chan<- Connection
}

// receiveConn is used to return a handle for the connection to where the
// connection was requested
func NewConnectionRequest(outgoing chan<- []byte, session Session, receiveConn chan<- Connection) ConnectionRequest {
	return ConnectionRequest{outgoing, session, receiveConn}
}
