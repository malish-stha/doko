import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'

const http = httpRouter()

const jwks = {
  keys: [
    {
      kty: 'RSA',
      n: 'n_CFfjZIJla1AdRXHKmv261oA-X9GbyDZOoG0bcVdASjdccYKk2zZ5fAdneXImFVwcwcSICdzm8zTFxFFOAPjXoHDxVTnfwB0dI6IxYwNLIewD_VoDVWo2OHmE62i0EmvJL4DaP5o9yPoefEroaWmzWtUv4o6cKqs7r163U7iiVCWmgADlFSgFCdE9KX0Zh8HTXMTUb1LeCv_2L2cFRp1-Il9HjzRQ4kXJd6eqOk7a1p9M2DZDWYdB-MJ_nKqq1yqdRmdqDSUZixhcjGVZSIQEIckjnLDY40nWBmMRxk8ZBoZFw-EAL7EIULEUpwfXEdODtja7LDyhNrN-AshCa6hw',
      e: 'AQAB',
      kid: 'doko-1',
      use: 'sig',
      alg: 'RS256',
    },
  ],
}

http.route({
  path: '/.well-known/jwks.json',
  method: 'GET',
  handler: httpAction(async () => {
    return new Response(JSON.stringify(jwks), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }),
})

export default http
