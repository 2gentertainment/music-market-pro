import { ImageResponse } from 'next/og';

export const size = {
  width: 64,
  height: 64,
};

export const contentType = 'image/png';

export default function Icon() {
  const bars = [
    { height: 34, color: '#ff8c00' },
    { height: 22, color: '#ff8c00' },
    { height: 15, color: '#ff8c00' },
    { height: 10, color: '#ff8c00' },
    { height: 15, color: '#ff8c00' },
    { height: 27, color: '#2ecc71' },
    { height: 34, color: '#ff8c00' },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#000000',
          borderRadius: '14px',
          border: '2px solid #262626',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingBottom: '15px',
          gap: '3px',
        }}
      >
        {bars.map((bar, idx) => (
          <div
            key={idx}
            style={{
              width: '3.5px',
              height: `${bar.height}px`,
              background: bar.color,
              borderRadius: '2px',
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
