import {validId,validateElection} from './vote.mjs';
const CREATE_KEY='voter-agent:create-request';
function read(storage,key){try{const raw=storage.getItem(key);return raw?JSON.parse(raw):null;}catch{return null;}}
export function loadCreation(storage){const saved=read(storage,CREATE_KEY);try{if(!saved||!validId(saved.request))return null;return {...validateElection(saved),request:saved.request};}catch{return null;}}
export function prepareCreation(storage,body){const config=validateElection(body),saved=loadCreation(storage);
 const request=saved&&JSON.stringify(validateElection(saved))===JSON.stringify(config)?saved.request:crypto.randomUUID();
 const payload={...config,request};storage.setItem(CREATE_KEY,JSON.stringify(payload));return payload;}
export function clearCreation(storage){storage.removeItem(CREATE_KEY);}
export function saveLastVote(storage,payload){if(!payload||![payload.election,payload.voter,payload.candidate,payload.request].every(validId))throw new Error('Invalid retry payload');storage.setItem('voter-agent:last-vote:'+payload.election,JSON.stringify(payload));}
export function loadLastVote(storage,election){const saved=read(storage,'voter-agent:last-vote:'+election);if(!saved||saved.election!==election||![saved.election,saved.voter,saved.candidate,saved.request].every(validId))return null;return saved;}
