package user

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

type IdGenerator struct {
	nextId connectionId
}

func (gen *IdGenerator) Next() connectionId {
	gen.nextId++ // Start ids at 1 and not 0
	return gen.nextId
}
