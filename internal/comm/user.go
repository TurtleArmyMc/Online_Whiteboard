package comm

const ServerUserId = 0

type UserId uint

type User struct {
	Id      UserId
	Session string
}
