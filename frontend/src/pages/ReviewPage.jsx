import { useSearchParams } from 'react-router-dom'
import { ReviewWizard } from '../components/ReviewWizard'

// ReviewPage is now a thin wrapper around the multi-step ReviewWizard.
// The wizard handles all state, validation, submission, and the seal-stamp
// celebration. This page just passes through the URL search params so
// that ?uni=<slug> pre-fills the university field.
export const ReviewPage = () => {
  const [searchParams] = useSearchParams()
  return <ReviewWizard searchParams={searchParams} />
}
