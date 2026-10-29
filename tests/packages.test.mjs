import assert from "node:assert/strict";
import {test} from "node:test";
import fs from "node:fs";
import {createRequire} from "node:module";
import ts from "typescript";
const require=createRequire(import.meta.url),loadedModule={exports:{}};
const code=ts.transpileModule(fs.readFileSync("lib/trip-pricing.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function("require","module","exports",code)(require,loadedModule,loadedModule.exports);
const {sumBillableComponents,includedPackageName}=loadedModule.exports;
test("package total counts once while hotel, air and transfers retain their prices",()=>{
 const rows=[{id:"p",component_type:"package",total_price:4500},{component_type:"hotel",total_price:1800,package_id:"p"},{component_type:"air",total_price:2200,package_id:"p"},{component_type:"transfer",total_price:500,package_id:"p"},{component_type:"insurance",total_price:250}];
 assert.equal(sumBillableComponents(rows),4750);
 assert.equal(rows[1].total_price,1800);
 rows[1].package_id=null;
 assert.equal(sumBillableComponents(rows),6550,"unchecking restores the original standalone price");
});
test("multiple packages, standalone extras, fees and decimal cents calculate consistently",()=>{
 assert.equal(sumBillableComponents([{id:"a",total_price:"4500"},{id:"b",total_price:600},{total_price:999,package_id:"b"},{total_price:250}])+100,5450);
 assert.equal(sumBillableComponents([{total_price:0.1},{total_price:0.2}]),0.3);
 assert.equal(sumBillableComponents([{total_price:0},{total_price:null},null,undefined]),0);
 assert.throws(()=>sumBillableComponents([{total_price:"bad"}]),/invalid price/);
});
test("existing standalone bookings retain the same totals and package labels are explicit",()=>{
 assert.equal(sumBillableComponents([{total_price:100},{total_price:200},{total_price:300}]),600);
 assert.equal(includedPackageName({package_id:"p"},[{id:"p",display_name:"Beach vacation"}]),"Beach vacation");
 assert.equal(includedPackageName({package_id:null},[]),null);
});
