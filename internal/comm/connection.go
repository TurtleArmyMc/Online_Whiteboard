package comm

type ConnId uint

type Connection struct {
	listener chan []byte
	id       ConnId
	userId   UserId
}

func (conn *Connection) Broadcast(packet Packet) error {
	data, err := packet.encoded()
	if err != nil {
		return err
	}
	conn.listener <- data
	return nil
}
