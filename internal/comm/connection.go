package comm

type Connection struct {
	listener chan []byte
	id       uint
	userId   uint
}

func (conn *Connection) Broadcast(packet Packet) error {
	data, err := packet.encoded()
	if err != nil {
		return err
	}
	conn.listener <- data
	return nil
}
