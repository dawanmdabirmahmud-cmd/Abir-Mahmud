export const BODY_LIMIT = 25000;
export function checkWriteRequest(request) {
 if(request.method==='GET'||request.method==='HEAD')return;
 const origin=request.headers.get('origin');
 if(!origin || origin!==new URL(request.url).origin) throw new Response('Origin not allowed',{status:403});
 const size=request.headers.get('content-length');
 if(size!==null && (!/^\d+$/.test(size)||!Number.isSafeInteger(Number(size)))) throw new Response('Invalid content length',{status:400});
 if(size!==null && Number(size)>BODY_LIMIT) throw new Response('Request too large',{status:413});
}
export async function readJSON(request) {
 const type=(request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(type!=='application/json')throw new Response('Content-Type must be application/json',{status:415});
 if(!request.body)throw new Response('JSON body required',{status:400});
 const reader=request.body.getReader();let total=0;const chunks=[];
 try {while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;
 if(total>BODY_LIMIT){await reader.cancel();throw new Response('Request too large',{status:413});}chunks.push(value);}}
 finally {reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Response('Invalid JSON',{status:400});}
}
