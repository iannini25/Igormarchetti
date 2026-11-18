import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guard, submit, admin, SURVEY_VERSION, NOTICE_VERSION} from '../api/_lib/survey.js';
import pg from 'pg';

const sample = {
  submission_id:'89b587b5-de4b-465e-817d-f362e5e305c1', survey_version:SURVEY_VERSION, notice_version:NOTICE_VERSION,
  milestone_risk:'Launch a pilot', control_gap:'Supplier checks', support_needed:'Review our plan',
  contact_name:'Test Founder', fintech_name:'Example Fintech', work_email:'founder@example.test'
};
function response() {
  return {writeHead(status) { this.status = status; }, end(body) { this.body = body; }};
}
test('contact details are required before a founder enquiry can be stored', async t => {
  t.mock.method(pg.Pool.prototype, 'query', () => { throw Error('Invalid contact details reached the database'); });
  const previous = process.env.PUBLIC_ORIGIN;
  process.env.PUBLIC_ORIGIN = 'https://lippi.example';
  t.after(() => { if (previous === undefined) delete process.env.PUBLIC_ORIGIN; else process.env.PUBLIC_ORIGIN = previous; });
  for (const patch of [{contact_name:' '}, {fintech_name:''}, {work_email:'invalid'}, {work_email:'a@b.c\nBcc:other@example.test'}]) {
    const res=response();
    await guard(submit)({method:'POST', headers:{origin:process.env.PUBLIC_ORIGIN, 'content-type':'application/json'}, body:{...sample,...patch}},res);
    assert.equal(res.status,400);
  }
});
test('private replies include contact information and the AI export omits contact fields', async t => {
  const vars=['SURVEY_ADMIN_KEY','SURVEY_DATABASE_URL'];
  const previous=vars.map(k=>process.env[k]);
  process.env.SURVEY_ADMIN_KEY='a'.repeat(32);
  process.env.SURVEY_DATABASE_URL='postgres://example.invalid';
  t.after(()=>vars.forEach((k,i)=>{ if(previous[i]===undefined) delete process.env[k]; else process.env[k]=previous[i]; }));
  const row={...sample,id:sample.submission_id,created_at:'2026-11-18T10:00:00Z'};
  t.mock.method(pg.Pool.prototype, 'query', async sql => ({rows:sql.includes('ORDER BY') ? [row] : []}));
  for(const path of ['responses','export.csv','export.json','analysis-pack.json']){
    const res=response();
    await admin({method:'GET',headers:{authorization:'Bearer '+process.env.SURVEY_ADMIN_KEY}},res,path);
    assert.equal(res.status,200);
    for(const key of ['contact_name','fintech_name','work_email']) assert.equal(res.body.includes(sample[key]),path!=='analysis-pack.json');
  }
});
