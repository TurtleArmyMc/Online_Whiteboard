package user

type SetUserIdPacket Id

func (packet SetUserIdPacket) PacketType() string {
	return "set_uid"
}
