import { renderHeader, renderFooter } from './src/components.js'
import { renderLandingPage, initLandingPage } from './src/pages/landing.js'
import { renderUniversityPage } from './src/pages/university.js'
import { renderReviewPage, initReviewPage } from './src/pages/review.js'

const app = document.querySelector('#app')

function parseRoute() {
  const hash = window.location.hash.slice(1) || '/'
  const [path, queryString] = hash.split('?')
  const queryParams = {}
  if (queryString) {
    new URLSearchParams(queryString).forEach((value, key) => {
      queryParams[key] = value
    })
  }
  return { path, queryParams }
}

function render() {
  const { path, queryParams } = parseRoute()
  window.scrollTo(0, 0)

  let pageHTML = ''
  let initFn = null

  if (path === '/' || path === '') {
    pageHTML = renderLandingPage()
    initFn = initLandingPage
  } else if (path.startsWith('/university/')) {
    const uniId = path.split('/')[2]
    pageHTML = renderUniversityPage(uniId)
  } else if (path === '/review') {
    pageHTML = renderReviewPage(queryParams)
    initFn = initReviewPage
  } else {
    pageHTML = `<div class="container"><div class="empty-state" style="padding-top: 6rem;">
      <h1>Page not found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <a href="#/" class="btn btn-primary mt-2">Go home</a>
    </div></div>`
  }

  app.innerHTML = renderHeader(path) + `<main>${pageHTML}</main>` + renderFooter()

  if (initFn) initFn()
}

window.addEventListener('hashchange', render)
render()
