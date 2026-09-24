// Lighthouse CI — runs the built site (dist/) as a static server.
// Assertions are the performance/accessibility/SEO floor from the plan.
module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      url: ['/', '/universities', '/university/tsinghua-university'],
      numberOfRuns: 1,
      settings: {
        // static-file-server serves app.html shell too; LHCI hits the real files
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 1 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 1500 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
}
