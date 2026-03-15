/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_TELEMETRY_DISABLED: '1' },
  async rewrites() {
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    // Ensure the URL always has a protocol prefix
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      apiUrl = 'https://' + apiUrl;
    }
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
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
