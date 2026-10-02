import {build} from 'esbuild';
import {rm,mkdir,cp} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true}); await mkdir('dist'); await cp('public','dist',{recursive:true}); console.log('Built dist');

await build({entryPoints:['public/app.js'],outfile:'dist/app.js',bundle:true,format:'esm',minify:true});
