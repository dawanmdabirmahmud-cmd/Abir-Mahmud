import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { checkWriteRequest } from './http.mjs';
export function database() { if(!env.DB) throw new Error('Database binding unavailable'); return env.DB; }
export function json(data:unknown,status=200) { return Response.json(data,{status,headers:{'Cache-Control':'no-store'}}); }
export async function authorize(request:Request) {
 const user=await getChatGPTUser();
 if(!user) throw new Response('Sign in required',{status:401});
 checkWriteRequest(request);
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
