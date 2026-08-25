import { Link } from 'react-router-dom'
import { Icons } from '../components/Icons'

// NotFoundPage component
export const NotFoundPage = () => (
  <div className="container">
    <div className="empty-state" style={{ paddingTop: '6rem' }}>
      <h1>Page not found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn btn-primary mt-2">
        <Icons.ArrowLeft /> Go home
      </Link>
    </div>
  </div>
)
