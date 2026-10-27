import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
const require=createRequire(import.meta.url);
function load(file) {
  const full=path.resolve(file);
  const code=ts.transpileModule(fs.readFileSync(full,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const loaded={exports:{}};
  const resolve=name=>name.startsWith(".")?load(path.resolve(path.dirname(full),name+".ts")):require(name);
  new Function("require","module","exports",code)(resolve,loaded,loaded.exports);
  return loaded.exports;
}
const { getInsuranceQuoteOptions, getVisibleInsuranceQuoteOptions, getSelectedInsuranceOptionNumber, getInsuranceSelectionPayload } = load("lib/insurance/quote-options.ts");
const quotes=[1,2,3].map(number=>({option_number:number,provider_name:"Allianz",plan_name:["Journey Plan","Latitude Plan","Classic Plan with Cancel Anytime"][number-1],premium_amount:[100,220,350][number-1],coverage_description:`Coverage ${number}`}));
test("clients see all quotes before selection and only the selected plan afterward",()=>{
  assert.equal(getVisibleInsuranceQuoteOptions({quote_options:quotes},"quoted").length,3);
  for(const selected of [1,2,3]) {
    const visible=getVisibleInsuranceQuoteOptions({quote_options:quotes,selected_option_number:selected},"quoted");
    assert.equal(visible.length,1);assert.equal(visible[0].optionNumber,selected);
    assert.equal(visible[0].premiumAmount,quotes[selected-1].premium_amount);
    assert.equal(visible[0].coverageDescription,`Coverage ${selected}`);
  }
  assert.equal(quotes.length,3,"unused quotes are retained for advisor history");
});
test("every booked status uses the selected premium rather than the first quote",()=>{
  const options=getInsuranceQuoteOptions({quote_options:quotes});
  for(const status of ["reserved","confirmed","pending_final_payment","paid_in_full","travel_complete"]) {
    const result=getInsuranceSelectionPayload(options,2,status);
    assert.equal(result.option.planName,"Latitude Plan");assert.equal(result.totalPrice,220);
    assert.throws(()=>getInsuranceSelectionPayload(options,null,status),/Select an insurance plan/);
  }
  for(const status of ["quoted","on_hold","cancelled"]) assert.equal(getInsuranceSelectionPayload(options,3,status).totalPrice,0);
});
test("missing and invalid premiums cannot be selected; zero is a valid explicit quote",()=>{
  for(const amount of [null,undefined,"",-1,"not money",Infinity]) {
    const options=getInsuranceQuoteOptions({quote_options:[{...quotes[0],premium_amount:amount}]});
    assert.throws(()=>getInsuranceSelectionPayload(options,1,"quoted"),/valid premium/);
  }
  assert.equal(getInsuranceSelectionPayload(getInsuranceQuoteOptions({quote_options:[{...quotes[0],premium_amount:0}]}),1,"reserved").totalPrice,0);
  assert.throws(()=>getInsuranceSelectionPayload(getInsuranceQuoteOptions({quote_options:quotes}),4,"quoted"),/valid insurance plan/);
});
test("legacy booked plans infer a unique matching quote and unselected quotes never infer a choice",()=>{
  const details={quote_options:quotes,plan_name:"Latitude Plan",premium_amount:220};
  assert.equal(getSelectedInsuranceOptionNumber(details,"quoted"),null);
  assert.equal(getSelectedInsuranceOptionNumber(details,"confirmed"),2);
  assert.deepEqual(getVisibleInsuranceQuoteOptions(details,"confirmed").map(x=>x.optionNumber),[2]);
  assert.equal(getSelectedInsuranceOptionNumber({...details,selected_option_number:3},"confirmed"),3);
  const legacy=getInsuranceQuoteOptions({plan_name:"Custom legacy plan",premium_amount:150});
  assert.equal(legacy[0].coverageDescription,null);assert.equal(legacy[0].brochureUrl,null);
});
