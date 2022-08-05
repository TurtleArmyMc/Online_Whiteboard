package user

type mapNamesPacket map[Id]string

func (packet mapNamesPacket) PacketType() string {
	return "map_usernames"
}

func (users *Manager) NewMapNamesPacket() OutgoingPacket {
	return mapNamesPacket(users.names)
}
