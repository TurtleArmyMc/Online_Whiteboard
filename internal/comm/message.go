package comm

type Message struct {
	Packet Packet
	Sender uint // Connection id
}
