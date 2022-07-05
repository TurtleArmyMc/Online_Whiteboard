package user

type mapNamesPacket map[Id]string

func (packet mapNamesPacket) PacketType() string {
	return "map_names"
}

func (users *Manager) NewMapNamesPacket() OutgoingPacket {
	users.mu.RLock()
	defer users.mu.RUnlock()

	return mapNamesPacket(users.names)
}
