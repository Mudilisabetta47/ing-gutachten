/** @type {import('next').NextConfig} */
const nextConfig = {
  // Statischer Export: das Ergebnis laeuft auf jedem Webspace (out/).
  // Fuer Vercel/Netlify mit SSR einfach diese Zeile entfernen.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
