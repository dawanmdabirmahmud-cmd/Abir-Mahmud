import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';
export function database() { if(!env.DB) throw new Error('Database binding unavailable'); return env.DB; }
export function json(data:unknown,status=200) { return Response.json(data,{status,headers:{'Cache-Control':'no-store'}}); }
export async function authorize(request:Request) {
 const user=await getChatGPTUser();
 if(!user) throw new Response('Sign in required',{status:401});
 if(request.method!=='GET') {
  const origin=request.headers.get('origin');
  if(!origin || origin!==new URL(request.url).origin) throw new Response('Origin not allowed',{status:403});
  const len=Number(request.headers.get('content-length')||0);
  if(len>25000) throw new Response('Request too large',{status:413});
 }
 return user.userId;
}
export async function owned(id:string,user:string) {
 const election=await database().prepare('SELECT id,title,state,created FROM elections WHERE id=? AND owner=?').bind(id,user).first();
 if(!election) throw new Response('Election not found',{status:404});
 return election;
}
export function failure(error:unknown) {
 if(error instanceof Response) return error;
 console.error('Voter service operation failed');
 return json({error:'Could not complete the request. Refresh or retry with the same request ID.'},503);
}
