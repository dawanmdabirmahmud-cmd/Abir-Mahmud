import Dashboard from './dashboard';
import { requireChatGPTUser } from './chatgpt-auth';
import {database} from '../lib/server';
import {listElections,loadSnapshot} from '../lib/snapshot.mjs';
export const dynamic='force-dynamic';
export default async function Page(){
 const user=await requireChatGPTUser('/');
 try{const db=database(),elections=await listElections(db,user.userId);
 const snapshot=elections[0]?await loadSnapshot(db,elections[0].id,user.userId):null;
 return <Dashboard initialElections={elections} initialSnapshot={snapshot}/>;
 }catch{return <Dashboard initialError="Your workspace could not be loaded. Use Retry loading to try again."/>;}
}
