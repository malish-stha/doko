import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#020617',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
          padding: 80,
          border: '12px solid #14b8a6',
        }}
      >
        <div style={{ fontSize: 32, color: '#2dd4bf', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 24 }}>
          DOKO
        </div>
        <div style={{ fontSize: 64, fontWeight: 500, textAlign: 'center', lineHeight: 1.15, maxWidth: 900 }}>
          The 4-sentence morning brief for your team.
        </div>
        <div style={{ fontSize: 22, color: '#94a3b8', marginTop: 32 }}>
          No dashboards. No Slack scrolling. Just the answer.
        </div>
      </div>
    ),
    size,
  )
}
