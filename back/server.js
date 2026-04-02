const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

// Store strokes per room
const rooms = {};

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join a room
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);

    // Send existing strokes to the new user
    if (rooms[roomId]) {
      socket.emit("load-strokes", rooms[roomId]);
    } else {
      rooms[roomId] = [];
    }
  });

  // Draw event
  socket.on("draw", ({ roomId, x, y, color }) => {
    // Save stroke
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push({ x, y, color });

    // Broadcast to others in the room
    socket.to(roomId).emit("draw", { x, y, color });
  });

  // Clear canvas
  socket.on("clear", (roomId) => {
    rooms[roomId] = [];
    socket.to(roomId).emit("clear");
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Test route
app.get("/", (req, res) => {
  res.send("Whiteboard backend running 🚀");
});

const PORT = 5005;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});