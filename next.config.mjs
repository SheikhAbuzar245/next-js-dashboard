/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vapi.ai",
      },
    ],
  },
};

export default nextConfig;
