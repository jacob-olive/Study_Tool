const nextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      new URL("https://assets.tailwindcss.com/templates/compass/**"),
    ],
  },
};

export default nextConfig;
