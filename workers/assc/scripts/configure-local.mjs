import { mkdir,writeFile } from 'node:fs/promises';
import { createAuthConfig } from '../auth.mjs';
import { fileURLToPath } from 'node:url';
const root=new URL('../.private/',import.meta.url);
if(process.stdin.isTTY) {
  process.stdout.write('Enter the local passcode (input hidden): ');
  process.stdin.setRawMode(true);
}
let value='';
process.stdin.setEncoding('utf8');
process.stdin.on('data',async chunk=>{
  if(chunk.includes('\u0003')) process.exit(130);
  if(chunk.includes('\n') || chunk.includes('\r')) {
    value+=chunk.replace(/[\r\n]/g,'');
    process.stdin.pause();if(process.stdin.isTTY)process.stdin.setRawMode(false);
    if(!value.trim()){process.stderr.write('\nPasscode required.\n');process.exit(1);}
    const config=await createAuthConfig(value);value='';
    await mkdir(root,{recursive:true});
    await writeFile(new URL('auth.json',root),JSON.stringify(config),{mode:0o600});
    process.stdout.write('\nLocal authentication configured; verifier stays in ignored .private/auth.json.\n');process.exit(0);
  }
  value+=chunk;
});
