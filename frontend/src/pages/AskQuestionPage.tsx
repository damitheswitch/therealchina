import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { Icons } from '../components/Icons'
import { useToast } from '../contexts/ToastContext'
import { COMMUNITY_CATEGORIES } from '../lib/community'

// /community/ask — new question form. PROTOTYPE: submit shows a toast and
// returns to the feed; nothing is persisted.
export const AskQuestionPage = () => {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [city, setCity] = useState('')
  const [university, setUniversity] = useState('')
  const [body, setBody] = useState('')
  const [postAnon, setPostAnon] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (title.trim().length < 10) {
      showToast('Give it a proper title, at least 10 characters.', 'error')
      return
    }
    if (!category) {
      showToast('Pick a category.', 'error')
      return
    }
    if (body.trim().length < 20) {
      showToast('Add a bit more detail so people can actually help.', 'error')
      return
    }
    showToast('Question posted. Preview only, nothing was saved.', 'success')
    navigate('/community')
  }

  return (
    <div className="container ask-page">
      <Seo path="/community/ask" title="Ask a question" description="Ask the community." />
      <nav className="qa-crumb" aria-label="Breadcrumb">
        <Link to="/community">
          <Icons.ArrowLeft /> Community
        </Link>
      </nav>
      <header className="community-head">
        <div className="community-head-text">
          <p className="community-eyebrow">提问 · Ask</p>
          <h1>Ask a question</h1>
          <p className="community-sub">
            The more specific you are, the better the answers. Office names, cities, costs, dates.
          </p>
        </div>
      </header>

      <form className="ask-form" onSubmit={submit}>
        <div className="form-group">
          <label className="form-label" htmlFor="q-title">
            Question title
          </label>
          <input
            id="q-title"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Which bank opens accounts before the residence permit?"
            maxLength={160}
          />
          <span className="form-hint">
            One clear question. Someone searching it later should find it.
          </span>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="q-category">
            Category
          </label>
          <select
            id="q-category"
            className="form-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Pick one…</option>
            {COMMUNITY_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="q-body">
            Details
          </label>
          <textarea
            id="q-body"
            className="form-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What you tried, where you are, any deadlines. More context gets better answers."
          />
        </div>

        <div className="ask-form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="q-city">
              City <span className="form-hint">(optional)</span>
            </label>
            <input
              id="q-city"
              className="form-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Shanghai"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="q-uni">
              University <span className="form-hint">(optional)</span>
            </label>
            <select
              id="q-uni"
              className="form-select"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
            >
              <option value="">Not about a specific uni</option>
              <option value="tsinghua-university">Tsinghua University</option>
              <option value="peking-university">Peking University</option>
              <option value="fudan-university">Fudan University</option>
            </select>
          </div>
        </div>

        <label className="form-checkbox-label" htmlFor="q-anon">
          <input
            id="q-anon"
            type="checkbox"
            className="form-checkbox"
            checked={postAnon}
            onChange={(e) => setPostAnon(e.target.checked)}
          />
          Post anonymously
        </label>
        {postAnon && (
          <p className="form-hint">
            Your name is hidden from everyone. Moderators can still trace abuse.
          </p>
        )}

        <button type="submit" className="btn btn-primary">
          Post question
        </button>
      </form>
    </div>
  )
}
