"use client";

import Link from "next/link";
import { useState } from "react";
import { allianzInsurancePlans } from "@/lib/insurance/allianz-plans";
import type { InsuranceQuoteOption } from "@/lib/insurance/quote-options";
import { AiRewriteTextarea } from "./ai-rewrite-textarea";

export function InsurancePlanEditor({ options, selectedOptionNumber }: {
  options: InsuranceQuoteOption[];
  selectedOptionNumber: number | null;
}) {
  const [selected, setSelected] = useState(selectedOptionNumber === null ? "" : String(selectedOptionNumber));
  return (
    <div className="card stack" style={{ background: "#f7fbfc" }}>
      <h3 style={{ margin: 0 }}>{selected ? "Selected insurance plan" : "Quoted plans"}</h3>
      <label className="stack-sm">
        <span className="label">Selected insurance plan</span>
        <select className="select" name="insurance_selected_option_number" value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">No plan selected — show all quotes</option>
          {allianzInsurancePlans.map((plan) => <option key={plan.optionNumber} value={plan.optionNumber}>{plan.planName}</option>)}
        </select>
      </label>
      <p style={{ margin: 0, color: "#667085", lineHeight: 1.5 }}>
        {selected ? "Only this plan appears on the client's trip. Change the selection here if the client chooses another plan. Unused quotes remain in the advisor record."
          : "Enter premiums for up to three plans. The client can choose a quoted plan, or you can record their choice here."}
        {" "}Premiums enter trip totals when the selected plan is marked reserved or confirmed. Selecting a quote does not purchase coverage.
      </p>
      {allianzInsurancePlans.map((plan) => {
        const option = options.find((quote) => quote.optionNumber === plan.optionNumber);
        const suffix = plan.optionNumber === 1 ? "" : `_${plan.optionNumber}`;
        return (
          <div key={plan.optionNumber} hidden={Boolean(selected) && selected !== String(plan.optionNumber)}>
            <div className="stack" style={{ background: "#ffffff", border: "1px solid #e6f0f2", borderRadius: 8, padding: 16 }}>
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <div><h4 style={{ margin: 0 }}>{option?.planName || plan.planName}</h4><p style={{ margin: "4px 0 0", color: "#667085" }}>{option?.providerName || plan.providerName}</p></div>
                <Link className="btn btn-outline" href={plan.brochureUrl} target="_blank">View flyer</Link>
              </div>
              <input type="hidden" name={`insurance_provider_name${suffix}`} value={option?.providerName || plan.providerName} />
              <input type="hidden" name={`insurance_plan_name${suffix}`} value={option?.planName || plan.planName} />
              <label className="stack-sm"><span className="label">Premium amount — {plan.planName}</span>
                <input className="input" type="number" step="0.01" min="0" name={`insurance_premium_amount${suffix}`} defaultValue={option?.premiumAmount ?? ""} />
              </label>
              <AiRewriteTextarea label="Coverage Description" name={`insurance_coverage_description${suffix}`} defaultValue={option?.coverageDescription ?? plan.coverageSummary} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
