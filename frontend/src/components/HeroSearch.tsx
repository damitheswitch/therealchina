import { useSearchParams } from 'react-router-dom'

// Big search box in the home hero. It writes the same ?q= param the directory
// below reads, so typing here filters the grid without any extra state.
export const HeroSearch = () => {
  const [params, setParams] = useSearchParams()
  const value = params.get('q') ?? ''

  const setQuery = (next: string) => {
    const p = new URLSearchParams(params)
    if (next) p.set('q', next)
    else p.delete('q')
    p.delete('page')
    setParams(p, { replace: true, preventScrollReset: true })
  }

  return (
    <form
      className="hero-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        document.getElementById('grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }}
    >
      <input
        type="search"
        id="hero-search"
        className="search-input hero-search-input"
        placeholder="Search a university or city"
        aria-label="Search universities by name or city"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(e) => setQuery(e.target.value)}
      />
    </form>
  )
}
