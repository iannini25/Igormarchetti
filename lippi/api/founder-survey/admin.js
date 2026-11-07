import {admin,guard} from '../_lib/survey.js';
export default guard((req,res)=>admin(req,res,String(new URL(req.url,'http://x').searchParams.get('path')||'')));
