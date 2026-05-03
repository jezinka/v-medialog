import type {NextConfig} from "next";

const nextConfig: NextConfig = {
    output: 'standalone',
    serverExternalPackages: ['better-sqlite3'],
    images: {
        remotePatterns: [
            {protocol: "https", hostname: "covers.openlibrary.org"},
            {protocol: "https", hostname: "image.tmdb.org"},
            {protocol: "https", hostname: "books.google.com"},
            {protocol: "https", hostname: "lh3.googleusercontent.com"},
            {protocol: "https", hostname: "s.lubimyczytac.pl"},
        ],
    },
    experimental: {
        serverActions: {
            bodySizeLimit: '5mb'
        }
    }
};

export default nextConfig;
