import { authorize,database,json,failure } from '../../../lib/server';
import { validateElection, validId } from '../../../lib/vote.mjs';
import { createElection } from '../../../lib/election.mjs';
import { readJSON } from '../../../lib/http.mjs';
export async function GET(request:Request) {
 try {const user=await authorize(request);
 const result=await database().prepare('SELECT id,title,state,created FROM elections WHERE owner=? ORDER BY created DESC LIMIT 100').bind(user).all();
 return json({elections:result.results});}catch(e){return failure(e);}
}
export async function POST(request:Request){
 try{const user=await authorize(request),body=await readJSON(request);
 try{validateElection(body);if(!validId(body.request))throw new Error('A valid creation request ID is required.');}
 catch(e){return json({error:e instanceof Error?e.message:'Invalid election input'},400);}
 try{return json(await createElection(database(),user,body),201);}catch(e){
 if(e instanceof Error&&e.message==='CREATE_REQUEST_CONFLICT')return json({error:'This creation request was already used with different settings. Start a new election request.'},409);throw e;}
 }catch(e){return failure(e);}
}
