import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#000000',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: '10px',
          padding: '42px 30px',
        }}
      >
        <div style={{ width: '10px', height: '96px', background: '#FF8C00', borderRadius: '6px' }} />
        <div style={{ width: '10px', height: '66px', background: '#FF8C00', borderRadius: '6px' }} />
        <div style={{ width: '10px', height: '48px', background: '#FF8C00', borderRadius: '6px' }} />
        <div style={{ width: '10px', height: '34px', background: '#FF8C00', borderRadius: '6px' }} />
        <div style={{ width: '10px', height: '48px', background: '#FF8C00', borderRadius: '6px' }} />
        <div style={{ width: '10px', height: '80px', background: '#2ECC71', borderRadius: '6px' }} />
        <div style={{ width: '10px', height: '96px', background: '#FF8C00', borderRadius: '6px' }} />
      </div>
    ),
    { ...size }
  );
}
