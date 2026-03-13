/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_TELEMETRY_DISABLED: '1' },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'opnrenovation.com' },
    ],
  },
};

module.exports = nextConfig;
