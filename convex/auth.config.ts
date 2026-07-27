export default {
  providers:
    process.env.CONVEX_AUTH_DOMAIN &&
    !process.env.CONVEX_AUTH_DOMAIN.includes('localhost')
      ? [
          {
            domain: process.env.CONVEX_AUTH_DOMAIN,
            applicationID: 'doko',
          },
        ]
      : [],
}
