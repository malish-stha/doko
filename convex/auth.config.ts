export default {
  providers: [
    {
      domain: process.env.CONVEX_AUTH_DOMAIN || 'http://localhost:3000',
      applicationID: 'doko',
    },
  ],
}
