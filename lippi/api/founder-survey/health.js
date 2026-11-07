import {reply,SURVEY_VERSION,guard} from '../_lib/survey.js';
export default guard(async(req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD') return reply(res,405,{error:'Method not allowed.'});
 const ok=!!(process.env.SURVEY_DATABASE_URL&&process.env.PUBLIC_ORIGIN&&(process.env.SURVEY_ADMIN_KEY||'').length>=32);
 return reply(res,ok?200:503,ok?{ready:true,survey_version:SURVEY_VERSION}:{ready:false});
});
