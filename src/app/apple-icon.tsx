import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  const bars = [
    { height: 96, color: '#ff8c00' },
    { height: 64, color: '#ff8c00' },
    { height: 44, color: '#ff8c00' },
    { height: 28, color: '#ff8c00' },
    { height: 44, color: '#ff8c00' },
    { height: 76, color: '#2ecc71' },
    { height: 96, color: '#ff8c00' },
  ];

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
          paddingBottom: '42px',
          gap: '9px',
        }}
      >
        {bars.map((bar, idx) => (
          <div
            key={idx}
            style={{
              width: '9px',
              height: `${bar.height}px`,
              background: bar.color,
              borderRadius: '4px',
            }}
          />
        ))}
      </div>
    ),
    {
      ...size,
    }
  );
}
