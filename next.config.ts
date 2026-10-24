import type {NextConfig} from "next";

const nextConfig: NextConfig = {
    output: 'standalone',
    serverExternalPackages: ['better-sqlite3'],
    images: {
        remotePatterns: [
            {protocol: "https", hostname: "covers.openlibrary.org"},
            {protocol: "https", hostname: "image.tmdb.org"},
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
