'use client'
export default function AgentClient() {
  const token = '6448ceba724efa6b6c4675f77025beca'
  return (
    <iframe
      src={`/openclaw-ui/index.html?token=${token}`}
      style={{ flex: 1, border: 'none', display: 'block', minHeight: 0 }}
      allow="microphone; camera; clipboard-read; clipboard-write"
    />
  )
}
