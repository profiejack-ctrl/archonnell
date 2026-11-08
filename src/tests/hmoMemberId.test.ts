// Maxicare member IDs entered by HR: an ID saved for another employee's family is refused, one saved within the same
// family needs HR's confirmation, and a confirmed ID can be corrected with a reason kept in the history.
import {describe,expect,it} from 'vitest';
import {memberIdCheck} from '../../backend-render/hmoRules.js';
import server from '../../backend-render/server.js?raw';

const maria={id:'en-maria',employee_id:'maria',maxicare_reference:'MC-2026-048213'},paolo={id:'dep-paolo',employee_id:'maria',name:'Paolo Santos',maxicare_reference:'MC-2026-048214'},carlo={id:'en-carlo',employee_id:'carlo',maxicare_reference:'MC-2026-050000'};
const members=[maria,paolo,carlo];

describe('checking a member ID',()=>{
 it('finds it on another employee',()=>{
  expect(memberIdCheck('MC-2026-048213','carlo','en-carlo',members)).toEqual({other:maria,family:null});
 });
 it('finds it on another employee\'s dependent',()=>{
  expect(memberIdCheck('MC-2026-048214','carlo','en-carlo',members).other).toBe(paolo);
 });
 it('ignores capitals, spaces and dashes',()=>{
  expect(memberIdCheck(' mc 2026 048213','carlo','en-carlo',members).other).toBe(maria);
 });
 it('finds it within the same family',()=>{
  expect(memberIdCheck('MC-2026-048213','maria','dep-paolo',members)).toEqual({other:null,family:maria});
 });
 it('does not count the record being saved',()=>{
  expect(memberIdCheck('mc-2026-048213','maria','en-maria',members)).toEqual({other:null,family:null});
 });
 it('allows a new or empty ID',()=>{
  expect(memberIdCheck('MC-2026-099999','carlo','en-carlo',members)).toEqual({other:null,family:null});
  expect(memberIdCheck('  ','carlo','en-carlo',[...members,{id:'x',employee_id:'y',maxicare_reference:''}])).toEqual({other:null,family:null});
 });
});

describe('the server',()=>{
 it('checks when confirming an employee or dependent and when correcting',()=>{
  expect(server.match(/await ensureMemberIdFree\(reference, await memberEmployeeId\(\), targetId, b\.allow_shared === true\);/g)).toHaveLength(3);
 });
 it('refuses another family always, and the same family unless confirmed',()=>{
  expect(server).toContain("if (other) throw new HttpError(409, 'MAXICARE_REFERENCE_IN_USE'");
  expect(server).toContain("if (family && !allowShared) throw new HttpError(409, 'MAXICARE_REFERENCE_SHARED'");
 });
 it('keeps the reason for a correction in the history',()=>{
  expect(server).toContain("'member_id_corrected', ctx.userId, previous, { ...updated, correction_reason: reason }");
 });
});
