package room

import (
	"regexp"
	"sort"
	"strings"
	"unicode"
)

var valid_name_re = regexp.MustCompile("^[a-z0-9][a-z0-9_]*$")

var rooms = map[string]*Room{}

func ValidName(name string) bool {
	return valid_name_re.MatchString(UrlName(name))
}

// Gets or creates room.
// public is ignored if the room already exists
func GetRoom(name string, public bool) *Room {
	if !ValidName(name) {
		return nil
	}
	key := UrlName(name)
	room := rooms[key]
	if room == nil {
		room = newRoom(name, public)
		rooms[key] = room
	}
	return room
}

type Info struct {
	Name            string
	OnlineUserCount int
}

func PublicRooms() []Info {
	list := []Info{}
	for _, room := range rooms {
		if room.public {
			list = append(list, Info{room.name, len(room.users.OnlineUsers())})
		}
	}
	// Show rooms with most users first
	sort.Slice(list, func(i, j int) bool {
		if list[i].OnlineUserCount != list[j].OnlineUserCount {
			return list[i].OnlineUserCount > list[j].OnlineUserCount
		}
		return strings.ToLower(list[i].Name) < strings.ToLower(list[j].Name)
	})
	return list
}

// Maps to lowercase and replaces any whitespace with _
func UrlName(name string) string {
	name = strings.Replace(name, "%20", "_", -1) // May be unnecessary?
	name = strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) {
			return '_'
		} else {
			return unicode.ToLower(r)
		}
	}, name)
	name = strings.Trim(name, "_")
	return name
}
