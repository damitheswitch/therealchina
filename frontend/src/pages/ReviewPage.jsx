import { useSearchParams } from 'react-router-dom'
import { ReviewWizard } from '../components/ReviewWizard'
import { Seo } from '../components/Seo'

// ReviewPage is now a thin wrapper around the multi-step ReviewWizard.
// The wizard handles all state, validation, submission, and the seal-stamp
// celebration. This page just passes through the URL search params so
// that ?uni=<slug> pre-fills the university field.
export const ReviewPage = () => {
  const [searchParams] = useSearchParams()
  return (
    <>
      <Seo path="/review" title="Write a review" index={false} />
      <ReviewWizard searchParams={searchParams} />
    </>
  )
}
