const NextAuth = (_config: unknown) => ({
  handlers: { GET: jest.fn(), POST: jest.fn() },
  signIn: jest.fn(),
  signOut: jest.fn(),
  auth: jest.fn(),
})

export default NextAuth
