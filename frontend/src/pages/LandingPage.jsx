import { Link } from 'react-router-dom'
import { UniversityDirectory } from '../components/UniversityDirectory'
import { Seo } from '../components/Seo'
import { stringify, websiteSchema, orgSchema } from '../lib/seo/jsonld'
import { Icons } from '../components/Icons'

// LandingPage component
export const LandingPage = () => {
  return (
    <>
      <Seo
        path="/"
        description="Honest reviews of Chinese universities by international students — real costs, campus life and the support nobody puts in a brochure."
        jsonLd={[stringify(websiteSchema()), stringify(orgSchema())]}
      />
      <section className="hero">
        <div className="container hero-inner">
          <h1>Real reviews from real students.</h1>
          <p className="hero-subtitle">
            Authentic, community-driven university reviews for international students in China.
          </p>
          <div className="hero-buttons">
            <a href="#grid" className="btn btn-primary btn-lg">
              Browse Universities
            </a>
            <Link to="/review" className="btn btn-outline btn-lg">
              <Icons.Pen /> Leave a Review
            </Link>
          </div>
        </div>
      </section>

      <UniversityDirectory />
    </>
  )
}
