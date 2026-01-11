import axios from 'axios'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import io, { Socket } from 'socket.io-client'
import './App.css'

// Then use pollFromQuery as initial pollId
const SOCKET_URL = 'http://localhost:3000'

interface Poll {
  id: string
  question: string
  options: string[]
  votes: Record<string, number>
}

function App() {
  const [pollId, setPollId] = useState<string>('')
  const [poll, setPoll] = useState<Poll | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [selectedOption, setSelectedOption] = useState<string>('')
  const [searchParams] = useSearchParams()

  // Connect socket once
  useEffect(() => {
    const newSocket = io(SOCKET_URL)
    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [])

  useEffect(() => {
    const poll = searchParams.get('poll')
    if (!poll) return
    if ((poll && poll?.length) ?? 0 > 0) {
      setPollId(poll)
    }
  }, [searchParams])
  // Load poll when pollId changes
  useEffect(() => {
    if (!pollId) return

    // Fetch initial poll data
    axios
      .get(`http://localhost:3000/api/polls/${pollId}`)
      .then((res) => {
        setPoll(res.data)
        // Join the poll room
        socket?.emit('join-poll', pollId)
      })
      .catch((err) => alert('Poll not found'))
  }, [pollId, socket, searchParams])

  // Listen for live updates
  useEffect(() => {
    if (!socket) return

    socket.on('poll-update', (votes: Record<string, number>) => {
      setPoll((prev) => (prev ? { ...prev, votes } : null))
    })

    return () => {
      socket.off('poll-update')
    }
  }, [socket])

  const handleVote = () => {
    if (!selectedOption || !pollId) return
    socket?.emit('vote', { pollId, option: selectedOption })
    // Optional: disable further voting for this user
  }

  const createNewPoll = async () => {
    try {
      const res = await axios.post('http://localhost:3000/api/polls', {
        question: "What's your favorite color?",
        options: ['Red', 'Blue', 'Green', 'Yellow']
      })
      setPollId(res.data.pollId)
    } catch (err) {
      alert('Failed to create poll')
    }
  }

  return (
    <div className="App">
      <h1>Live Poll</h1>

      {!pollId && <button onClick={createNewPoll}>Create Sample Poll</button>}

      {pollId && !poll && <p>Loading poll...</p>}

      {poll && (
        <>
          <h2>{poll.question}</h2>

          <div className="options">
            {poll.options.map((opt) => (
              <div key={opt} className="option">
                <label>
                  <input
                    type="radio"
                    name="vote"
                    value={opt}
                    checked={selectedOption === opt}
                    onChange={() => setSelectedOption(opt)}
                  />
                  {opt}
                </label>

                <div className="bar-container">
                  <div
                    className="bar"
                    style={{
                      width: `${
                        ((poll.votes[opt] || 0) /
                          Math.max(
                            1,
                            Object.values(poll.votes).reduce((a, b) => a + b, 0)
                          )) *
                        100
                      }%`
                    }}
                  >
                    {poll.votes[opt] || 0} votes
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleVote} disabled={!selectedOption}>
            Vote
          </button>
        </>
      )}

      {pollId && (
        <p>
          Poll ID: <a href={`http://localhost:5173/?poll=${pollId}`}>{pollId}</a>
        </p>
      )}
    </div>
  )
}

export default App
