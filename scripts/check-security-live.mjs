// Explicit opt-in live check: creates and removes one disposable account. Never sends email.
import assert from "node:assert/strict";
import { randomUUID, createHash, createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
const require=createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
if(process.env.RUN_LIVE_SECURITY_CHECK!=="1") throw Error("Set RUN_LIVE_SECURITY_CHECK=1 to allow disposable test records.");
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const email="security-check+"+randomUUID()+"@example.invalid",password="Security!"+randomUUID();
let userId,accountId,profileId,browser;
const jar=new Map();
const client=createServerClient(url,key,{cookies:{
 getAll:()=>Array.from(jar,([name,value])=>({name,value})),
 setAll:values=>values.forEach(({name,value})=>jar.set(name,value)),
}});
function check(result){if(result.error)throw Error(result.error.message);return result.data;}
function totp(secret) {
 const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits="";
 for(const char of secret.toUpperCase().replace(/=+$/,""))bits+=chars.indexOf(char).toString(2).padStart(5,"0");
 const bytes=Buffer.from((bits.match(/.{8}/g)||[]).map(byte=>parseInt(byte,2)));
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const h=createHmac("sha1",bytes).update(counter).digest(),o=h[19]&15;
 return String((h.readUInt32BE(o)&0x7fffffff)%1000000).padStart(6,"0");
}
async function site(pathname,options={}) {
 const headers=new Headers(options.headers);headers.set("Cookie",Array.from(jar,([n,v])=>n+"="+v).join("; "));
 return fetch(process.env.SECURITY_TEST_BASE_URL+pathname,{...options,headers,redirect:"manual"});
}
try {
 const created=check(await admin.auth.admin.generateLink({type:"signup",email,password,options:{data:{first_name:"Security",last_name:"Check"}}}));
 userId=created.user.id;
 assert.equal(created.user.email_confirmed_at,undefined);
 const before=await client.auth.signInWithPassword({email,password});
 assert(before.error,"Unconfirmed account must not be able to sign in");
 const premature=await admin.rpc("complete_client_registration",{p_auth_user_id:userId});
 assert(premature.error,"Unverified account must not be linked");
 check(await client.auth.verifyOtp({type:"signup",token_hash:created.properties.hashed_token}));
 accountId=check(await admin.rpc("complete_client_registration",{p_auth_user_id:userId}));
 assert(accountId);
 const profile=check(await admin.from("user_profiles").select("id").eq("auth_user_id",userId).single());profileId=profile.id;
 assert.equal(check(await admin.rpc("complete_client_registration",{p_auth_user_id:userId})),accountId);
 const own=check(await client.from("client_accounts").select("id"));
 assert.deepEqual(own.map(row=>row.id),[accountId]);
 console.log("PASS email confirmation, pre-verification denial, idempotent account linking, client isolation");
 const scope="security-check-"+randomUUID(),actor=createHash("sha256").update(userId).digest("hex");
 const attempts=await Promise.all(Array.from({length:20},()=>admin.rpc("consume_security_rate_limit",{p_scope:scope,p_key:actor,p_limit:5,p_window_seconds:60})));
 assert.equal(attempts.map(check).filter(data=>data.allowed).length,5);
 console.log("PASS atomic shared quota: exactly 5 of 20 concurrent requests allowed");
 check(await admin.from("user_profiles").update({role:"admin"}).eq("id",profileId));
 if(process.env.SECURITY_TEST_BASE_URL) {
   const adminBlocked=await site("/api/admin/clients/mailing-export");assert.equal(adminBlocked.status,403);
   const mfa=await site("/auth/mfa");assert.equal(mfa.status,200);assert.match(await mfa.text(),/Secure your admin access/);
 }
 let factor;
 if (process.env.SECURITY_PLAYWRIGHT_PATH && process.env.SECURITY_TEST_BASE_URL) {
   const { chromium } = await import(process.env.SECURITY_PLAYWRIGHT_PATH);
   browser = await chromium.launch({ channel: "chrome", headless: true });
   const base = new URL(process.env.SECURITY_TEST_BASE_URL);
   const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
   await context.addCookies(Array.from(jar,([name,value])=>({name,value,domain:base.hostname,path:"/",httpOnly:false,secure:base.protocol==="https:"})));
   const page = await context.newPage();
   await page.goto(base.origin+"/auth/mfa");
   await page.getByRole("button",{name:"Set up authenticator"}).click();
   await page.getByAltText("Authenticator setup QR code").waitFor();
   const secret = (await page.locator("details code").textContent()).trim();
   assert(secret.length>10);
   assert(await page.getByAltText("Authenticator setup QR code").evaluate(img=>img.complete && img.naturalWidth>0));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
   await page.getByRole("textbox",{name:"Authenticator code"}).fill(totp(secret));
   await page.getByRole("button",{name:"Verify and continue"}).click();
   await page.waitForURL("**/admin/dashboard");
   const verified = check(await client.auth.mfa.listFactors()).totp.find(f=>f.status==="verified");
   assert(verified);
   factor = {id:verified.id,totp:{secret}};
   console.log("PASS mobile MFA screen, rendered QR, six-digit code submission, admin redirect");
 } else {
   factor=check(await client.auth.mfa.enroll({factorType:"totp",friendlyName:"Disposable security check"}));
 }
 check(await client.auth.mfa.challengeAndVerify({factorId:factor.id,code:totp(factor.totp.secret)}));
 assert.equal(check(await client.auth.mfa.getAuthenticatorAssuranceLevel()).currentLevel,"aal2");
 if(process.env.SECURITY_TEST_BASE_URL) {
   const mfaApi=await site("/api/admin/clients/mailing-export");assert.equal(mfaApi.status,200);
   assert.match(mfaApi.headers.get("cache-control"),/no-store/);
 }
 console.log("PASS real authenticator enrollment, code verification, AAL2 session and admin API enforcement");
 check(await client.auth.refreshSession());
 check(await client.auth.signOut());
 assert.equal(check(await client.auth.getSession()).session,null);
 console.log("PASS session refresh and logout");
} finally {
 if(browser)await browser.close();
 if(accountId)check(await admin.from("client_accounts").delete().eq("id",accountId));
 if(profileId)check(await admin.from("user_profiles").delete().eq("id",profileId));
 if(userId)check(await admin.auth.admin.deleteUser(userId));
 console.log("Disposable authentication records removed.");
}
