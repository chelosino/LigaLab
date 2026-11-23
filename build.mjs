import { build } from 'esbuild';
await build({ entryPoints: ['src/auth-client.js'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, outfile: 'public/vendor/auth.js' });
