import { expect, it } from 'vitest';
import { decodePattern } from './pattern';
it('decodes user DNA and supported custom traits instead of a fixed fixture',()=>{
 expect(decodePattern('02030405',[['Color','String',0,1,'options',['a','b','c']],['Level','Number',1,1,'range',[10,20]],['N','Number',2,2,'rawNumber']])).toEqual([{name:'Color',value:'c'},{name:'Level',value:13},{name:'N',value:1284}]);
});
it('rejects unsupported, unbounded or ambiguous patterns',()=>{for(const pattern of [[['X','Number',0,8,'rawNumber']],[['X','String',0,1,'eval',['script']]],[['X','Number',0,1,'range',[5,5]]],[['X','Number',0,1,'rawNumber'],['X','Number',0,1,'rawNumber']]])expect(()=>decodePattern('01020304',pattern)).toThrow();});
