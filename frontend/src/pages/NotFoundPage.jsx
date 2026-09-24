import { Link, useLocation } from 'react-router-dom'
import { Icons } from '../components/Icons'
import { Seo } from '../components/Seo'

// NotFoundPage component
export const NotFoundPage = () => {
  const { pathname } = useLocation()
  return (
    <div className="container">
      <Seo path={pathname} title="Page not found" index={false} />
      <div className="empty-state" style={{ paddingTop: '6rem' }}>
        <h1>Page not found</h1>
        <p>The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link to="/" className="btn btn-primary mt-2">
          <Icons.ArrowLeft /> Go home
        </Link>
      </div>
    </div>
  )
}
