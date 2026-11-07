import pg from 'pg';
import {createHash, timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const SURVEY_VERSION='founder-v1', NOTICE_VERSION='2026-11-06';
export const fields=['milestone_risk','control_gap','support_needed'];
export const questions=[
 'What’s your next milestone, and what could stop you reaching it?',
 'Which controls worry you most, and what have you tried so far?',
 'What help would make the biggest difference over the next 90 days?'
];
const T='public.lippi_survey_responses';
let poolPromise;
// SURVEY_DATABASE_URL may list several candidate URLs (whitespace-separated); the first that connects is used.
const db0=async()=>{
 const urls=String(process.env.SURVEY_DATABASE_URL||'').split(/\s+/).filter(Boolean);
 if(!urls.length) throw new Error('SURVEY_DATABASE_URL missing');
 let last;
 for(const u of urls){
  const p=new pg.Pool({connectionString:u,ssl:{rejectUnauthorized:false},max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:6000});
  try{await p.query('select 1');return p;}catch(e){last=e;p.end().catch(()=>{});}
 }
 throw last;
};
const pool=()=>(poolPromise??=db0().catch(e=>{poolPromise=undefined;throw e;}));
const db=()=>({query:async(...a)=>(await pool()).query(...a)});
const digest=v=>createHash('sha256').update(v).digest();
export const csvCell=value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s)) s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
export const redact=v=>v.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email removed]').replace(/(?:https?:\/\/|www\.)\S+/gi,'[URL removed]').replace(/(?:\+\d[\d ()-]{7,}\d|\b\d{10,15}\b)/g,'[phone-like number removed]');
const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-store'};
export const reply=(res,code,data,extra={})=>{
 res.writeHead(code,{...headers,'Content-Type':'application/json; charset=utf-8',...extra});
 res.end(typeof data==='string'?data:JSON.stringify(data));
};
// best-effort in-memory rate limit per warm instance (hashed, never stored)
const rates=new Map();
const ip=req=>String(req.headers['x-real-ip']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
export const takeRate=(req,group,limit)=>{
 const now=Date.now(),key=createHash('sha256').update(group+ip(req)).digest('hex'),old=rates.get(key);
 if(!old||old.until<now) rates.set(key,{count:1,until:now+3600000}); else old.count++;
 if(rates.size>10000) for(const [k,v] of rates) if(v.until<now) rates.delete(k);
 return rates.get(key).count<=limit;
};
export const purge=()=>db().query(`DELETE FROM ${T} WHERE created_at < now() - interval '90 days'`);
const rowOut=r=>({...r,created_at:new Date(r.created_at).toISOString()});
export const allRows=async()=>{await purge();return (await db().query(`SELECT id,created_at,survey_version,notice_version,milestone_risk,control_gap,support_needed FROM ${T} ORDER BY created_at DESC`)).rows.map(rowOut);};

export async function submit(req,res){
 if(req.method!=='POST') return reply(res,405,{error:'Method not allowed.'});
 const origin=new URL(process.env.PUBLIC_ORIGIN).origin;
 if(req.headers.origin!==origin) return reply(res,403,{error:'Please submit the survey from the Lippi website.'});
 if(!req.headers['content-type']?.startsWith('application/json')) return reply(res,415,{error:'JSON content is required.'});
 if(!takeRate(req,'submit',120)) return reply(res,429,{error:'Too many submissions. Please try again later.'});
 let size=0,chunks=[];
 for await(const c of req){size+=c.length;if(size>16384) return reply(res,413,{error:'Your submission is too long.'});chunks.push(c);}
 let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return reply(res,400,{error:'The submission could not be read.'});}
 if(!data||Array.isArray(data)||typeof data!=='object') return reply(res,400,{error:'Invalid submission.'});
 if(data.website) return reply(res,400,{error:'The submission could not be accepted.'});
 if(data.survey_version!==SURVEY_VERSION||data.notice_version!==NOTICE_VERSION) return reply(res,400,{error:'Please refresh the page before submitting.'});
 if(typeof data.submission_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.submission_id)) return reply(res,400,{error:'Invalid submission reference. Please refresh and try again.'});
 for(const f of fields) if(typeof data[f]!=='string'||data[f].trim().length<5||data[f].length>1000) return reply(res,400,{error:'Please answer each question using between 5 and 1,000 characters.'});
 const answers=fields.map(f=>data[f].trim()), id=data.submission_id.toLowerCase();
 const ins=await db().query(`INSERT INTO ${T}(id,survey_version,notice_version,milestone_risk,control_gap,support_needed) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING RETURNING id`,[id,SURVEY_VERSION,NOTICE_VERSION,...answers]);
 if(ins.rowCount) return reply(res,201,{saved:true,id:data.submission_id});
 const prior=(await db().query(`SELECT * FROM ${T} WHERE id=$1`,[id])).rows[0];
 if(fields.some((f,i)=>prior[f]!==answers[i])) return reply(res,409,{error:'This reference has already been submitted with different answers. Please refresh before submitting a new response.'});
 return reply(res,200,{saved:true,id:data.submission_id});
}

export async function admin(req,res,path){
 const key=process.env.SURVEY_ADMIN_KEY||'', v=req.headers.authorization||'';
 if(key.length<32||!v.startsWith('Bearer ')||!timingSafeEqual(digest(v.slice(7)),digest(key))){
  if(!takeRate(req,'admin',30)) return reply(res,429,{error:'Too many access attempts. Please try again later.'});
  return reply(res,401,{error:'A valid private access key is required.'});
 }
 if(req.method!=='GET') return reply(res,405,{error:'Method not allowed.'});
 const known=['responses','export.json','export.csv','analysis-pack.json'];
 if(!known.includes(path)) return reply(res,404,{error:'Not found.'});
 const rows=await allRows(), q=Object.fromEntries(fields.map((f,i)=>[f,questions[i]]));
 if(path==='responses') return reply(res,200,{count:rows.length,responses:rows});
 if(path==='export.json') return reply(res,200,{survey_version:SURVEY_VERSION,questions:q,responses:rows},{'Content-Disposition':'attachment; filename="lippi-survey-responses.json"'});
 if(path==='export.csv'){const keys=['id','created_at','survey_version','notice_version',...fields];
  return reply(res,200,'\uFEFF'+[keys,...rows.map(r=>keys.map(k=>r[k]))].map(r=>r.map(csvCell).join(',')).join('\r\n'),{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="lippi-survey-responses.csv"'});}
 return reply(res,200,{
  review_before_upload:'Email addresses, URLs and some phone-like numbers are masked. Names and other identifiers may remain. Review all free text before uploading to an AI service. No responses have been sent to an AI provider by this website.',
  analysis_prompt:readFileSync(new URL('./analysis-prompt.txt',import.meta.url),'utf8'),
  questions:q,
  responses:rows.map(r=>({response_id:r.id,date:r.created_at.slice(0,10),...Object.fromEntries(fields.map(f=>[f,redact(r[f])]))}))
 },{'Content-Disposition':'attachment; filename="lippi-survey-ai-analysis-pack.json"'});
}
export const guard=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){console.error('survey error',e?.code||e?.name);if(!res.headersSent) reply(res,500,{error:'We could not save or retrieve the response. Please try again.'});else res.end();}};
