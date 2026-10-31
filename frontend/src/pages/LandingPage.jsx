import { Link } from 'react-router-dom'
import { UniversityDirectory } from '../components/UniversityDirectory'
import { HeroSearch } from '../components/HeroSearch'
import {
  HomeStatLine,
  HomeHeroLogos,
  HomeSeamSeal,
  HomeStudentsSay,
  HomeStudentsAsking,
  HomeContributorBand,
  HomeFlights,
} from '../components/HomeSections'
import { Seo } from '../components/Seo'
import { stringify, websiteSchema, orgSchema } from '../lib/seo/jsonld'
import { REWARD_UI_ENABLED } from '../lib/reviewReward'
import { Icons } from '../components/Icons'

// LandingPage component
export const LandingPage = () => {
  return (
    <>
      <Seo
        path="/"
        description="Honest reviews of Chinese universities by international students: real costs, campus life and the support nobody puts in a brochure."
        jsonLd={[stringify(websiteSchema()), stringify(orgSchema())]}
      />
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <h1>What studying in China is really like</h1>
            <p className="hero-subtitle">
              Costs, dorms, visas and teaching, told by international students who live it.
            </p>
            <HeroSearch />
            <HomeStatLine />
            <div className="hero-buttons">
              <Link to="/review" className="btn btn-primary btn-lg">
                <Icons.Pen /> Leave a Review
              </Link>
              {REWARD_UI_ENABLED && (
                <Link to="/review" className="hero-reward-chip">
                  Free VPN gift for a full review
                </Link>
              )}
            </div>
          </div>
          <HomeHeroLogos />
        </div>
        <HomeSeamSeal />
      </section>

      <HomeStudentsSay />
      <HomeStudentsAsking />
      <HomeContributorBand />
      <HomeFlights />

      <UniversityDirectory featured hideSearch />
    </>
  )
}
