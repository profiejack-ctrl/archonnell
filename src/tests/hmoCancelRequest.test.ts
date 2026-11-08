// A request added by the only Admin must not get stuck: its submitter cannot approve it and HR cannot approve at all, so
// the submitter can cancel it while it is pending.
import {describe,expect,it} from 'vitest';
import {submittedByUser} from '../../backend-render/hmoRules.js';
import server from '../../backend-render/server.js?raw';

describe('who added a request',()=>{
 it('matches the same user, whatever the id type',()=>{
  expect(submittedByUser('u1','u1')).toBe(true);
  expect(submittedByUser(7,'7')).toBe(true);
 });
 it('does not match another user, or a request with no recorded submitter',()=>{
  expect(submittedByUser('u1','u2')).toBe(false);
  expect(submittedByUser(null,'u1')).toBe(false);
  expect(submittedByUser('u1',undefined)).toBe(false);
 });
});

describe('the server',()=>{
 it('still refuses approving or rejecting your own request',()=>{
  expect(server).toContain("if (['approve', 'reject'].includes(action) && submittedByUser(previous.submitted_by, ctx.userId))");
  expect(server).toContain("'HMO_SELF_APPROVAL'");
 });
 it('lets only the submitter cancel, and only while pending, closing it so it can be added again',()=>{
  const start=server.indexOf("action === 'cancel'"),block=server.slice(start,start+800);
  expect(block).toContain("'HMO_REQUEST_NOT_PENDING'");
  expect(block).toContain("if (!submittedByUser(previous.submitted_by, ctx.userId)) throw new HttpError(403, 'HMO_NOT_SUBMITTER'");
  expect(block).toContain("saveTransition('cancelled', targetId, previous, { approval_status: 'Rejected', status: 'Rejected'");
 });
});
