import { useEffect } from 'react'
import { apiUrl, wsUrl } from './api'
import { useStore } from './store'

export function useSocket() {
  const setTick = useStore((s) => s.setTick)
  const setVenue = useStore((s) => s.setVenue)

  useEffect(() => {
    fetch(apiUrl('/api/venue')).then((r) => r.json()).then(setVenue).catch(() => {})

    let sock: WebSocket
    let dead = false
    const connect = () => {
      sock = new WebSocket(wsUrl('/ws'))
      sock.onmessage = (e) => setTick(JSON.parse(e.data))
      sock.onclose = () => { if (!dead) setTimeout(connect, 1000) }
      sock.onerror = () => sock.close()
    }
    connect()
    return () => { dead = true; sock?.close() }
  }, [setTick, setVenue])
}
