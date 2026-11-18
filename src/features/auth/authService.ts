import {read,write,remove} from '../../utils/storage';
import type {Session,User} from '../../types/domain';
import {API_BASE,AUTH_URL} from '../../config/api';

// Server role keys and the labels the app shows.
export type ServerRole='admin'|'hr_staff'|'finance';
export const roleLabel=(role:string):User['role']=>{
  const key=role.trim().toLowerCase().replace(/[\s-]+/g,'_');
  return (key==='admin'||key==='superadmin')?'Admin':key==='finance'?'Finance':'HR Staff';
};
export const serverRole=(role:User['role']):ServerRole=>role==='Admin'?'admin':role==='Finance'?'finance':'hr_staff';

const functionBase=API_BASE;
interface Envelope<T>{data:T;meta?:Record<string,unknown>}
const connectionMessage='Unable to connect to the sign-in service. Check your internet connection and try again. If the problem continues, the authentication service may be unavailable.';

async function edgePost<T>(slug:string,body:unknown):Promise<T>{
 let response:Response;
 try{
   response=await fetch(`${functionBase}/${slug}`,{
     method:'POST',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify(body)
   });
 } catch(cause){
   if(cause instanceof TypeError)throw new Error(connectionMessage);
   throw cause;
 }
 const payload=await response.json().catch(()=>({} as Envelope<T> & {error?:{message?:string};message?:string}));
 if(!response.ok){
  const providerMessage='error' in payload&&payload.error?.message?payload.error.message:('message' in payload?payload.message:'');
  const message=response.status===404?`The sign-in service is not available yet. Please contact an administrator or try again later.`:response.status===405?`The sign-in service rejected this request. Please contact an administrator.`:providerMessage||`Sign-in could not be completed (HTTP ${response.status}).`;
  throw new Error(message);
 }
 return ('data' in payload?payload.data:payload) as T;
}

export interface LoginChallenge {message:string;otp_required?:boolean;challenge_id?:string;employee_id?:string;emailId?:string|null}
export type LoginResult=LoginChallenge|Session;

export async function login(email:string,password:string):Promise<LoginResult>{
  if(!email||!password)throw new Error('Email and password are required.');

  let response: Response;
  try {
    response = await fetch(`${AUTH_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
  } catch (cause) {
    if (cause instanceof TypeError) throw new Error(connectionMessage);
    throw cause;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = (payload as any).message || (payload as any).error?.message || `Sign-in could not be completed (HTTP ${response.status}).`;
    throw new Error(msg);
  }

  const data = (payload as any).data || payload;
  if (data && data.token) {
    const rawRole = (data.user?.role || '').toLowerCase();
    const mappedRole: User['role'] = (rawRole.includes('admin') || rawRole.includes('super')) ? 'Admin' : (rawRole.includes('finance') ? 'Finance' : 'HR Staff');
    const user: User = {
      id: data.user?.id || 'admin',
      employeeId: data.user?.employee_id || 'EMP-ADMIN',
      name: data.user?.name || [data.user?.first_name, data.user?.last_name].filter(Boolean).join(' ') || 'Admin User',
      displayName: data.user?.first_name || 'Admin',
      role: mappedRole,
      email: data.user?.email || email
    };
    const session: Session = {
      token: data.token,
      user
    };
    write('session:token', session.token);
    write('session:user', session.user);
    try { window.localStorage.setItem('archon_token', session.token); } catch {}
    return session;
  }

  return data as LoginResult;
}

export async function verifyOtp(employeeId:string,code:string,challengeId:string):Promise<Session>{
  if(!employeeId)throw new Error('Your login challenge is missing. Please start again.');
  if(code.length!==6)throw new Error('Enter the 6-digit code.');
  const s=await edgePost<Session>('auth-verify-otp',{employee_id:employeeId,code,challenge_id:challengeId});
  write('session:token',s.token);
  write('session:user',s.user);
  try { window.localStorage.setItem('archon_token', s.token); } catch {}
  return s;
}

export const getCurrentUser=()=>{
  const stored = read<Session['user']|null>('session:user',null);
  if (stored) return stored;
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('archon_token') : null;
  if (!token) return null;
  const fallbackUser: Session['user'] = {
    id: 'admin',
    employeeId: 'EMP-ADMIN',
    name: 'Archon Administrator',
    displayName: 'Admin',
    role: 'Admin',
    email: 'admin@archonnell.com'
  };
  write('session:user', fallbackUser);
  write('session:token', token);
  return fallbackUser;
};

export const logout=()=>{
  remove('session:token');
  remove('session:user');
  try { window.localStorage.removeItem('archon_token'); } catch {}
};

/** The name shown in the header profile button: the display name, or the full name when none is set. */
export const profileName=(user:Session['user']|null)=>user?.displayName?.trim()||user?.name||'';
export const CURRENT_USER_EVENT='pbms:current-user';

/** Updates the signed-in user's stored details and tells the header to re-render. */
export function updateCurrentUser(patch:Partial<Session['user']>){
 const current=getCurrentUser();if(!current)return;
 write('session:user',{...current,...patch});
 window.dispatchEvent(new Event(CURRENT_USER_EVENT));
}

/** Re-reads the signed-in user's role, name and display name from the server; returns true when they changed. */
export async function refreshCurrentUser():Promise<boolean>{
 const current=getCurrentUser();if(!current)return false;
 try {
   const token = (typeof window !== 'undefined' ? window.localStorage.getItem('archon_token') : null) || read<string>('session:token', '');
   if (!token) return false;
   const response = await fetch(`${AUTH_URL}/me`, {
     headers: { 'Authorization': `Bearer ${token}` }
   });
   if (!response.ok) return false;
   const json = await response.json();
   const u = json.data?.user || json.data || json;
   if (u && u.email) {
     const role = roleLabel(u.role || '');
     const name = u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || current.name;
     const displayName = u.first_name || current.displayName;
     const email = u.email || current.email;
     if (role === current.role && name === current.name && email === current.email) return false;
     write('session:user', { ...current, role, name, displayName, email });
     return true;
   }
 } catch {}
 return false;
}
