import { config } from './middleware'

describe('middleware config', () => {
  it('protects app routes', () => {
    expect(config.matcher).toContain('/(app)/:path*')
  })
})
