import { ImageResponse } from 'next/og';

export const size = { width: 48, height: 48 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#000000',
          borderRadius: '11px',
          border: '2px solid #262626',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: '3px',
          padding: '10px 8px',
        }}
      >
        <div style={{ width: '3px', height: '26px', background: '#FF8C00', borderRadius: '2px' }} />
        <div style={{ width: '3px', height: '18px', background: '#FF8C00', borderRadius: '2px' }} />
        <div style={{ width: '3px', height: '13px', background: '#FF8C00', borderRadius: '2px' }} />
        <div style={{ width: '3px', height: '9px', background: '#FF8C00', borderRadius: '2px' }} />
        <div style={{ width: '3px', height: '13px', background: '#FF8C00', borderRadius: '2px' }} />
        <div style={{ width: '3px', height: '22px', background: '#2ECC71', borderRadius: '2px' }} />
        <div style={{ width: '3px', height: '26px', background: '#FF8C00', borderRadius: '2px' }} />
      </div>
    ),
    { ...size }
  );
}
