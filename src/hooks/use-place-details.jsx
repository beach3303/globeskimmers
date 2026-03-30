import * as React from "react"

const WORKER_BASE = "https://globeskimmers-api.maizasimeon.workers.dev"
const cache = new Map()

export function usePlaceDetails(placeId) {
  const [details, setDetails] = React.useState(placeId ? cache.get(placeId) ?? null : null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState(null)

  React.useEffect(() => {
    if (!placeId) return

    if (cache.has(placeId)) {
      setDetails(cache.get(placeId))
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetch(`${WORKER_BASE}/places/details/${placeId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Details fetch failed (${res.status})`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const place = data.place ?? null
        cache.set(placeId, place)
        setDetails(place)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [placeId])

  return { details, isLoading, error }
}
