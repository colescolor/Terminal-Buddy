import {useEffect,useState} from 'react'
import type {AccountView} from '@shared/account'
import {useStore} from '../store/useStore'
export default function AccountIndicator():React.JSX.Element|null{
 const [status,setStatus]=useState<AccountView|null>(null)
 useEffect(()=>{const refresh=()=>void window.buddy.account.status().then(setStatus);refresh();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh)}},[])
 if(!status?.configured||status.state==='free'||status.state==='paid'||status.state==='signed-out')return null
 const label=status.state==='trial'?Math.max(0,Math.ceil(((status.trialEndsAt||0)-Date.now())/86400000))+' trial days remaining':status.state==='expired'?'Access ended — your open terminals remain available':status.state==='unknown'?'Account status needs a refresh':status.state==='cancelling'?'Renewal canceled; paid access remains active':status.state==='past_due'?'Payment needs attention':'Account'
 return <div className="account-status-strip"><button className="text-btn" onClick={()=>useStore.getState().setSettingsOpen(true)}>{label} · Account</button></div>
}
