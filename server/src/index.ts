import { serve } from '@hono/node-server'
import { randomUUID } from 'crypto'
import { Hono } from 'hono'
import { Server as SocketIOServer } from 'socket.io'
import type { CreatePollRequest, Poll } from './types.ts'

import { cors } from 'hono/cors'
// In-memory storage (for demo only)
const polls = new Map<string, Poll>()

const app = new Hono()

app.use(
  '/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Upgrade']
  })
)
// 1. Create a new poll
app.post('/api/polls', async (c) => {
  const body = (await c.req.json()) as CreatePollRequest

  if (!body.question || !Array.isArray(body.options) || body.options.length < 2) {
    return c.json({ error: 'Invalid poll data' }, 400)
  }

  const pollId = randomUUID()
  const poll: Poll = {
    id: pollId,
    question: body.question,
    options: body.options,
    votes: Object.fromEntries(body.options.map((opt) => [opt, 0]))
  }

  polls.set(pollId, poll)

  return c.json({ pollId, ...poll }, 201)
})

// 2. Get poll details (with current results)
app.get('/api/polls/:pollId', (c) => {
  const pollId = c.req.param('pollId')
  const poll = polls.get(pollId)

  if (!poll) {
    return c.json({ error: 'Poll not found' }, 404)
  }

  return c.json(poll)
})

const io = new SocketIOServer({
  cors: {
    origin: '*', // ← change to your frontend URL in production
    methods: ['GET', 'POST']
  }
})

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  // Join a poll room
  socket.on('join-poll', (pollId: string) => {
    if (!polls.has(pollId)) return

    socket.join(`poll:${pollId}`)
    console.log(`Socket ${socket.id} joined poll:${pollId}`)

    // Optional: send current state immediately
    const poll = polls.get(pollId)!
    socket.emit('poll-update', poll.votes)
  })

  // Handle vote (we'll do voting over WebSocket for real-time feel)
  socket.on('vote', ({ pollId, option }: { pollId: string; option: string }) => {
    const poll = polls.get(pollId)
    if (!poll || !poll.options.includes(option)) return

    // Increment vote
    poll.votes[option] = (poll.votes[option] || 0) + 1

    // Broadcast updated votes to everyone in the poll room
    io.to(`poll:${pollId}`).emit('poll-update', poll.votes)

    console.log(`Vote received in ${pollId} for "${option}"`)
  })

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id)
  })
})

// Start server
const port = 3000
// httpServer.listen(port, () => {
//   console.log(`Server running on http://localhost:${port}`)
// })
//
// Also let Hono handle the HTTP routes
// HTTP Server + Socket.io
const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 Server running on http://localhost:${info.port}`)
})

io.attach(server)
