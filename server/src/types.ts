export interface Poll {
  id: string
  question: string
  options: string[]
  votes: Record<string, number> // option → vote count
}

export interface CreatePollRequest {
  question: string
  options: string[]
}
