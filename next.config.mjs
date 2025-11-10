const nextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      new URL("https://assets.tailwindcss.com/templates/compass/**"),
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
