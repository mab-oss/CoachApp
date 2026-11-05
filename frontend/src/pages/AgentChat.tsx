import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../api'
import SuggestionCard from '../components/SuggestionCard'
import type { Suggestion, ToolCall } from '../types'

interface ChatItem {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  suggestion?: Suggestion | null
  mode?: string
}

const GREETING =
  "Hi, I'm your CoachApp agent. I read your workout history, calculate trends, and propose " +
  'training adjustments. Ask me "How am I doing?" or "What should I do next?" - you approve ' +
  'or reject every suggestion.'

const QUICK_PROMPTS = ['How am I doing?', 'What should I do next?', 'Am I plateauing?']

export default function AgentChat() {
  const [messages, setMessages] = useState<ChatItem[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api
      .listMessages()
      .then((rows) => {
        if (rows.length === 0) {
          setMessages([{ role: 'assistant', content: GREETING }])
          return
        }
        setMessages(
          rows.map((row) => ({
            role: row.role === 'user' ? 'user' : 'assistant',
            content: row.content,
          })),
        )
      })
      .catch(() => setMessages([{ role: 'assistant', content: GREETING }]))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  function updateSuggestion(updated: Suggestion) {
    setMessages((current) =>
      current.map((message) =>
        message.suggestion?.id === updated.id ? { ...message, suggestion: updated } : message,
      ),
    )
  }

  async function send(text: string) {
    const message = text.trim()
    if (!message || busy) return
    setError('')
    setInput('')
    setBusy(true)
    setMessages((current) => [...current, { role: 'user', content: message }])

    try {
      const response = await api.chat(message)
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: response.reply,
          toolCalls: response.tool_calls,
          suggestion: response.suggestion,
          mode: response.mode,
        },
      ])
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Could not reach the coach.'
      setError(detail)
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: 'Sorry, I could not complete that request. Please try again.' },
      ])
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void send(input)
  }

  return (
    <div className="page chat-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">AI agent</p>
          <h1>Coach chat</h1>
          <p className="muted">
            The agent calls <code>get_history</code>, <code>get_progress</code> and{' '}
            <code>suggest_adjustment</code>. Suggestions need your approval.
          </p>
        </div>
      </header>

      <div className="chat-shell card">
        <div className="chat-messages">
          {messages.map((message, index) => (
            <div className={`chat-row ${message.role}`} key={`${message.role}-${index}`}>
              <div className={`chat-bubble ${message.role}`}>
                <p>{message.content}</p>

                {message.mode && (
                  <span className="agent-mode">
                    {message.mode === 'claude' ? 'Claude tool-calling' : 'Built-in agent'}
                  </span>
                )}

                {message.toolCalls && message.toolCalls.length > 0 && (
                  <div className="tool-trace">
                    <span className="tool-trace-label">Tool calls</span>
                    <div className="tool-chips">
                      {message.toolCalls.map((call, callIndex) => (
                        <details className="tool-chip" key={`${call.name}-${callIndex}`}>
                          <summary>{call.name}</summary>
                          <pre>
                            {JSON.stringify(
                              { arguments: call.arguments, result: call.result },
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      ))}
                    </div>
                  </div>
                )}

                {message.suggestion && (
                  <SuggestionCard
                    suggestion={message.suggestion}
                    onResolved={updateSuggestion}
                  />
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="chat-row assistant">
              <div className="chat-bubble assistant typing">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
                <span className="typing-label">Checking your training data...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="chat-quick">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="chip-btn"
              disabled={busy}
              onClick={() => void send(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>

        {error && <p className="form-error chat-error">{error}</p>}

        <form className="chat-composer" onSubmit={handleSubmit}>
          <input
            className="input"
            type="text"
            value={input}
            maxLength={1000}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about your progress or what to change next..."
            aria-label="Message the coach"
          />
          <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
