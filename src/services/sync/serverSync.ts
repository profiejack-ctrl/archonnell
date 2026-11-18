import {apiClient} from '../api/apiClient';
import {can} from '../../features/auth/permissions';
import {NOTIFICATIONS_EVENT,NOTIFICATIONS_KEY} from '../../features/notifications/notificationService';
import {soundHoldMs} from '../../features/notifications/notificationSound';

type PendingWrite={raw?:string;deleted?:boolean};
// Logs & Audit is kept by the server, so 'audit:' keys are no longer synchronized.
const PREFIXES=['admin:','attendance:','benefits:','claims:','compensation:','deductions:','leave:','notifications:','payroll:','reimbursement:','settings:'];
const synced=(key:string)=>PREFIXES.some(prefix=>key.startsWith(prefix));
// Payroll Settings keys: every 'payroll:' key except the payroll data HR keeps, plus the legacy 13th month rules key.
const PAYROLL_DATA_KEYS=['payroll:runs','payroll:records','payroll:payouts','payroll:timesheet-locks','payroll:bank-results'];
const settingsKey=(key:string)=>(key.startsWith('payroll:')&&!PAYROLL_DATA_KEYS.includes(key))||key==='compensation:thirteenth-month-rules';
// Attendance now comes from HR2; purge the retired manually-entered copies.
const RETIRED_KEYS=['attendance:records','attendance:schedule'];
const rawSet=Storage.prototype.setItem;
const rawRemove=Storage.prototype.removeItem;
const timers=new Map<string,number>();
const pending=new Map<string,PendingWrite>();
let hydrating=false;

function sameWrite(left:PendingWrite|undefined,right:PendingWrite){
 return Boolean(left&&left.deleted===right.deleted&&left.raw===right.raw);
}
function schedulePush(key:string,write:PendingWrite,delay=400){
 window.clearTimeout(timers.get(key));
 pending.set(key,write);
 timers.set(key,window.setTimeout(()=>{
  const current=pending.get(key);
  if(!sameWrite(current,write))return;
  const request=write.deleted
   ?apiClient.post<{key:string;deleted:boolean},unknown>('/app-data',{key,deleted:true})
   :apiClient.post<{key:string;value:unknown},unknown>('/app-data',{key,value:JSON.parse(write.raw??'null')});
  void request.then(()=>{if(sameWrite(pending.get(key),write))pending.delete(key)})
   .catch(cause=>{
    if(!sameWrite(pending.get(key),write))return;
    // The server refused this change (403 for the signed-in role, 409 for a status change it does not allow): drop it and restore the server copy.
    if([403,409].includes((cause as {status?:number}).status??0)){pending.delete(key);rawRemove.call(window.localStorage,key);void hydrateFromServer(true);return}
    schedulePush(key,write,2000);
   });
 },delay));
}

Storage.prototype.setItem=function(this:Storage,key:string,value:string){
 rawSet.call(this,key,value);
 if(this===window.localStorage&&!hydrating&&synced(key))schedulePush(key,{raw:value});
};
Storage.prototype.removeItem=function(this:Storage,key:string){
 rawRemove.call(this,key);
 if(this===window.localStorage&&!hydrating&&synced(key))schedulePush(key,{deleted:true});
};
const RUNS_KEY = 'payroll:runs';

function mapBackendStatus(status?: string) {
  if (!status) return 'Draft';
  const s = String(status).toLowerCase();
  if (s === 'approved') return 'Approved';
  if (s === 'paid') return 'Paid';
  if (s === 'draft') return 'Draft';
  if (s === 'computed') return 'Computed';
  if (s === 'pending' || s === 'pending_approval') return 'Pending Approval';
  if (s === 'funded') return 'Funded';
  if (s === 'exported') return 'Exported';
  if (s === 'closed') return 'Closed';
  if (s === 'returned') return 'Returned';
  if (s === 'rejected') return 'Rejected';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function syncLivePayrollRuns() {
  try {
    const res = await apiClient.get<any>('/runs');
    const runsList = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
    if (!runsList.length) return;

    const existingJson = window.localStorage.getItem(RUNS_KEY);
    const existing = existingJson ? JSON.parse(existingJson) : [];
    const existingMap = new Map((Array.isArray(existing) ? existing : []).map((x: any) => [x.id, x]));

    const mappedRuns: any[] = [];
    for (const r of runsList) {
      let details = r;
      const existingRun = existingMap.get(r.id);
      if (!existingRun || !existingRun.rows || !existingRun.rows.length) {
        try {
          const detailRes = await apiClient.get<any>(`/runs/${r.id}`);
          details = detailRes?.data || detailRes || r;
        } catch {}
      } else {
        details = existingRun;
      }

      const payslips = details.payslips || details.rows || [];
      const rows = payslips.map((p: any) => {
        if (p.input && p.result) return p;
        return {
          position: p.position_title || 'Staff',
          rest: 0,
          hmo: 0,
          employmentStatus: 'Regular',
          input: {
            empId: p.employee_no || p.employee_id || '',
            name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Employee',
            dailyRate: Math.round(Number(p.basic_salary || 0) / 13),
            daysWorked: 13,
            absentDays: 0,
            lateMin: 0,
            undertimeMin: 0,
            otHours: 0,
            otRestHours: 0,
            vlDays: 0,
            slDays: 0,
            lwopDays: 0,
            holidayPay: 0,
            slConversion: 0,
            transportation: 0,
            riceSubsidy: 0,
            otherEarnings: 0,
            withholdingTax: 0,
            sssLoan: 0,
            pagibigLoan: 0,
            companyLoan: 0,
            cashAdvance: 0,
            otherDeductions: 0
          },
          result: {
            basic: Number(p.basic_salary || 0),
            overtime: 0,
            leavePay: 0,
            earnings: Number(p.gross_pay || p.basic_salary || 0),
            gross: Number(p.gross_pay || p.basic_salary || 0),
            late: 0,
            undertime: 0,
            lateUt: 0,
            sss: 607.50,
            phil: 337.50,
            pagibig: 100.00,
            tax: 305.70,
            loans: 0,
            deductions: Number(p.total_deductions || 0),
            net: Number(p.net_pay || 0),
            earnedBasic: Number(p.basic_salary || 0),
            absences: 0,
            allowances: 0,
            shortfall: 0
          }
        };
      });

      mappedRuns.push({
        id: r.id,
        runType: r.run_type || 'regular',
        from: (r.period_from || '').slice(0, 10),
        to: (r.period_to || '').slice(0, 10),
        payDate: (r.pay_date || '').slice(0, 10),
        status: mapBackendStatus(r.status),
        totals: {
          gross: Number(r.total_gross || 0),
          deductions: Number(r.total_deductions || 0),
          net: Number(r.total_net || 0)
        },
        rows,
        preparedBy: r.prepared_by || 'Admin',
        createdAt: r.created_at || new Date().toISOString(),
        submittedAt: r.submitted_at || undefined,
        decidedBy: r.decided_by || undefined,
        decidedAt: r.decided_at || undefined,
        decisionComment: r.decision_comment || undefined,
        paidAt: r.status === 'paid' ? (r.funded_at || r.decided_at || r.created_at) : undefined,
        paidBy: r.status === 'paid' ? (r.decided_by || 'Finance') : undefined,
        funding: r.funded_at || r.status === 'paid' ? {
          confirmedAt: r.funded_at || r.decided_at || r.created_at,
          confirmedBy: r.decided_by || 'Finance',
          confirmedById: 'finance',
          amount: Number(r.total_net || 0),
          receiptId: r.funding_receipt_url || undefined
        } : undefined
      });
    }

    rawSet.call(window.localStorage, RUNS_KEY, JSON.stringify(mappedRuns));
  } catch {}
}

export async function hydrateFromServer(reloadOnChange=false){
 hydrating=true;
 let changed=false;
 const notificationsBefore=window.localStorage.getItem(NOTIFICATIONS_KEY);
 try{
  const response=await apiClient.get<{data:{key:string;value:unknown;deleted?:boolean}[]}>('/app-data');
  const items=response.data;
  const serverKeys=new Set(items.map(item=>item.key));
  for(const item of items){
   // A local edit is newer than this snapshot; do not overwrite it while it is queued.
   if(pending.has(item.key))continue;
   if(RETIRED_KEYS.includes(item.key))continue;
   // Notifications update in place (bell, Notifications page, sound) instead of reloading the page.
   if(item.key===NOTIFICATIONS_KEY){if(item.deleted)rawRemove.call(window.localStorage,item.key);else rawSet.call(window.localStorage,item.key,JSON.stringify(item.value));continue}
   if(item.deleted){
    if(window.localStorage.getItem(item.key)!==null)changed=true;
    rawRemove.call(window.localStorage,item.key);
    continue;
   }
   const raw=JSON.stringify(item.value);
   if(window.localStorage.getItem(item.key)!==raw)changed=true;
   rawSet.call(window.localStorage,item.key,raw);
  }
  if(!serverKeys.has(RUNS_KEY)){
   await syncLivePayrollRuns();
  }
  // Without Payroll Settings access, payroll reads only the rates and rules it needs, read-only; they are never pushed back.
  const settingsHidden=!can('settings.view');
  if(settingsHidden){
   const rules=await apiClient.get<{data:{key:string;value:unknown}[]}>('/app-data?scope=payroll-rules');
   for(const item of rules.data){
    serverKeys.add(item.key);
    const raw=JSON.stringify(item.value);
    if(window.localStorage.getItem(item.key)!==raw)changed=true;
    rawSet.call(window.localStorage,item.key,raw);
   }
  }
  for(const key of RETIRED_KEYS)rawRemove.call(window.localStorage,key);
  for(let i=0;i<window.localStorage.length;i++){
   const key=window.localStorage.key(i);
   if(key&&settingsHidden&&settingsKey(key)&&!serverKeys.has(key)){rawRemove.call(window.localStorage,key);i--;continue}
   // Claims and receipts are sent only to roles that review or pay claims; a copy left from before is removed.
   if(key&&(key.startsWith('claims:')||key.startsWith('reimbursement:'))&&!can('claims.view')&&!serverKeys.has(key)){rawRemove.call(window.localStorage,key);i--;continue}
   if(key&&synced(key)&&!serverKeys.has(key)&&!pending.has(key)){
    const raw=window.localStorage.getItem(key);
    if(raw)schedulePush(key,{raw});
   }
  }
 }catch{/* keep the local copy when the server is unreachable */}
 finally{
  hydrating=false;
  if(window.localStorage.getItem(NOTIFICATIONS_KEY)!==notificationsBefore)window.dispatchEvent(new CustomEvent(NOTIFICATIONS_EVENT,{detail:{source:'poll'}}));
  // A notification sound that just started finishes before the reload.
  if(reloadOnChange&&changed)window.setTimeout(()=>window.location.reload(),soundHoldMs());
 }
 return changed;
}
