import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
 reactStrictMode: true,
 // Existing links to the v9.5 paths keep working after deployment.
 async redirects(){return [
  {source:'/documents',destination:'/docs',permanent:false},
  {source:'/documents/:fileId',destination:'/docs/:fileId',permanent:false},
  {source:'/spreadsheets',destination:'/sheets',permanent:false},
  {source:'/spreadsheets/:fileId',destination:'/sheets/:fileId',permanent:false},
 ];},
};
export default nextConfig;
