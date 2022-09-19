package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/turtlearmy/online-whiteboard/internal/room"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

// Gets the session cookie for the request, setting it if necessary
func getSession(c *gin.Context) user.Session {
	session, err := c.Cookie("session")
	if err != nil {
		session = string(user.NewSession())
		c.SetCookie("session", session, 24*24*60, "", "", false, false)
	}
	return user.Session(session)
}

func getIndex(c *gin.Context) {
	roomName := c.Request.URL.Query().Get("room_name")
	if room.ValidName(roomName) {
		public := c.Request.URL.Query().Get("public") == "on"
		room.GetRoom(roomName, public) // Create room
		roomId := room.UrlName(roomName)
		c.Redirect(http.StatusTemporaryRedirect, "/draw/"+roomId)
	} else {
		c.HTML(http.StatusOK, "index.tmpl.html", gin.H{"Rooms": room.PublicRooms()})
	}
}

func getWorkspace(c *gin.Context) {
	roomId := c.Param("room")
	roomName := room.GetRoom(roomId, false).Name()
	c.HTML(http.StatusOK, "workspace.tmpl.html", gin.H{"Name": roomName})
}

func main() {
	r := gin.Default()

	r.LoadHTMLFiles(
		"web/templates/workspace.tmpl.html",
		"web/templates/index.tmpl.html",
	)

	r.GET("/", getIndex)
	r.GET("/draw/:room", getWorkspace)
	r.GET("/draw/:room/ws", func(c *gin.Context) {
		room := room.GetRoom(c.Param("room"), false)
		if room == nil {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
		room.WsHandler(c.Writer, c.Request, getSession(c))
	})

	r.StaticFS("/javascript", http.Dir("web/static/javascript"))
	r.StaticFS("/css", http.Dir("web/static/css"))
	r.StaticFS("/icons", http.Dir("web/static/icons"))

	// Set session cookie for all connections
	r.Use(func(c *gin.Context) { getSession(c) })

	r.Run("0.0.0.0:8080")
}
