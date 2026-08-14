/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep heavy Node-only libs out of the webpack bundle — they run in the Node route handlers.
  experimental: {
    serverComponentsExternalPackages: ['@whiskeysockets/baileys', 'puppeteer'],
  },
};

export default nextConfig;
