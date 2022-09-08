package user

type OnlineUserIdsPacket []Id

func (packet OnlineUserIdsPacket) PacketType() string {
	return "set_online_users"
}
