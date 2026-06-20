/**
 * FinSource Bangladesh Income Tax Calculator — FY 2025-26
 * =========================================================
 * Plan.txt rules:
 *  - Gross Monthly Salary breakdown: Basic=60%, HRA=30%, Medical=6%, Conveyance=4%
 *  - July salary (1 month) is LOWER (pre-increment)
 *  - August–June salary (11 months) is HIGHER (post-increment)
 *  - Provident Fund: Employee 6% of basic + Office 6% of basic
 *  - Employee PF contribution is rebate-eligible
 *
 * Updated NBR 2025-26 Rules (Prothom Alo / Financial Express / PwC confirmed):
 *  - Rebate Rate: 10% (was 15%)
 *  - Admissible = min(3% of taxable income, 10% of actual investment, ৳7,50,000)
 *  - Quarterly filing incentive: Q1 Jul-Sep = 5% rebate (max ৳25,000)
 *  - Late surcharge: Q3 Jan-Mar = +2% (min ৳3,000), Q4 Apr-Jun = +5% (min ৳5,000)
 */

// ════════════════════════════════════════════════
// TAX CONFIGURATION
// ════════════════════════════════════════════════
const TAX_CONFIG = {
    // Salary breakdown percentages (per Plan.txt)
    SALARY_BASIC_PCT:      0.60,
    SALARY_HRA_PCT:        0.30,
    SALARY_MEDICAL_PCT:    0.06,
    SALARY_CONVEYANCE_PCT: 0.04,

    // Provident Fund rates (per Plan.txt)
    PF_EMPLOYEE_PCT: 0.06,
    PF_OFFICE_PCT:   0.06,

    // Tax-free thresholds
    TAX_FREE_LIMITS: {
        general:        375000,
        women_senior:   425000,
        disabled:       500000,
        third_gender:   500000,
        freedom_fighter:525000,
    },
    DISABLED_CHILD_EXTRA: 50000,

    // Progressive tax slabs
    TAX_SLABS: [
        { limit: 300000,  rate: 0.10, label: 'Next ৳3,00,000 @ 10%' },
        { limit: 400000,  rate: 0.15, label: 'Next ৳4,00,000 @ 15%' },
        { limit: 500000,  rate: 0.20, label: 'Next ৳5,00,000 @ 20%' },
        { limit: 2000000, rate: 0.25, label: 'Next ৳20,00,000 @ 25%' },
        { limit: Infinity,rate: 0.30, label: 'Remaining @ 30%' },
    ],

    // Minimum tax by area
    MINIMUM_TAX: { dhaka_ctg: 5000, other_city: 4000, outside_city: 3000 },

    // Investment rebate (updated 2025-26)
    REBATE_RATE:              0.10,   // 10% of admissible
    MAX_INVESTMENT_INCOME_PCT:0.03,   // 3% of taxable income
    MAX_INVESTMENT_ABSOLUTE:  750000, // ৳7,50,000 ceiling

    // DPS annual limit
    DPS_ANNUAL_LIMIT: 120000,

    // Consolidated allowance exemption
    MAX_ALLOWANCE_EXEMPTION:  450000,
    ALLOWANCE_BASIC_PCT:      1/3,

    // Quarterly filing rules
    FILING_QUARTERS: {
        q1: { label: 'July–September', rebatePct: 0.05, maxRebate: 25000, surcharge: 0, minSurcharge: 0 },
        q2: { label: 'October–December', rebatePct: 0, maxRebate: 0, surcharge: 0, minSurcharge: 0 },
        q3: { label: 'January–March', rebatePct: 0, maxRebate: 0, surcharge: 0.02, minSurcharge: 3000 },
        q4: { label: 'April–June', rebatePct: 0, maxRebate: 0, surcharge: 0.05, minSurcharge: 5000 },
    },

    MONTHS: ['July','August','September','October','November','December','January','February','March','April','May','June'],
};

// ════════════════════════════════════════════════
// UTILITY
// ════════════════════════════════════════════════
function formatTaka(n) {
    if (n === 0 || isNaN(n)) return '৳0';
    const abs = Math.abs(Math.round(n));
    const s = abs.toString();
    let fmt = s.length <= 3 ? s : s.slice(-3);
    let rem = s.length <= 3 ? '' : s.slice(0, -3);
    while (rem.length > 2) { fmt = rem.slice(-2) + ',' + fmt; rem = rem.slice(0, -2); }
    if (rem) fmt = rem + ',' + fmt;
    return (n < 0 ? '-' : '') + '৳' + fmt;
}

function getVal(id, fallback = 0) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const v = parseFloat(el.value);
    return isNaN(v) || v < 0 ? fallback : v;
}

function setVal(id, value) {
    const el = document.getElementById(id);
    if (el && el !== document.activeElement) el.value = value || '';
}

// ════════════════════════════════════════════════
// EVENT SETUP
// ════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('disabled-child').addEventListener('change', function() {
        document.getElementById('child-count-row').style.display = this.checked ? 'block' : 'none';
        calculate();
    });
    calculate();
});

function changeChildCount(delta) {
    const el = document.getElementById('disabled-child-count');
    el.value = Math.max(1, Math.min(10, (parseInt(el.value) || 1) + delta));
    calculate();
}

function changeBonusCount(delta) {
    const el = document.getElementById('bonus-count');
    el.value = Math.max(0, Math.min(6, (parseInt(el.value) || 2) + delta));
    calculate();
}

function toggleBreakdown() {
    const wrap = document.getElementById('breakdown-wrap');
    const tog = document.getElementById('breakdown-toggle');
    const isOpen = wrap.classList.contains('open');
    wrap.classList.toggle('open', !isOpen);
    tog.classList.toggle('open', !isOpen);
}

// ════════════════════════════════════════════════
// MAIN CALCULATION
// ════════════════════════════════════════════════
let currentDisplayValue = 0;

function calculate() {
    // ── 1. Read inputs ──
    const taxpayerType   = document.getElementById('taxpayer-type').value;
    const areaType       = document.getElementById('area-type').value;
    const filingQuarter  = document.getElementById('filing-quarter')?.value || 'q2';
    const hasDisabledChild   = document.getElementById('disabled-child').checked;
    const disabledChildCount = hasDisabledChild ? (parseInt(document.getElementById('disabled-child-count').value) || 1) : 0;
    
    const otherIncome      = getVal('other-income');

    const julyGross = getVal('july-gross');
    const augGross  = getVal('aug-gross');

    // Auto-calculate bonuses (FinSource Policy: based on Aug-Jun salary)
    const festivalBonusAmt = Math.round(augGross * 0.60 * 2);
    const perfBonusAmt     = Math.round(augGross * 0.20 * 2);
    
    // Display them in the readonly fields
    const festEl = document.getElementById('festival-bonus-amt');
    if(festEl) festEl.value = festivalBonusAmt || '';
    const perfEl = document.getElementById('perf-bonus-amt');
    if(perfEl) perfEl.value = perfBonusAmt || '';

    // ── 2. Salary Calculations (FinSource Rules) ──
    const C = TAX_CONFIG;
    
    // Total Salary (No breakdown counted for total)
    const totalSalary = julyGross + (augGross * 11);
    const annGrossSalary = totalSalary + festivalBonusAmt + perfBonusAmt;
    
    // Basic is only used to calculate Office Paid Tax and PF
    const annBasic = Math.round(julyGross * C.SALARY_BASIC_PCT) + Math.round(augGross * C.SALARY_BASIC_PCT) * 11;

    // ── 3. Provident Fund (NOT added to Gross Income) ──
    const annPFEmployee = Math.round(totalSalary * C.PF_EMPLOYEE_PCT);
    const annPFOffice   = Math.round(totalSalary * C.PF_OFFICE_PCT);

    // Auto-fill PF in investment field if user hasn't overridden it
    const pfInput = document.getElementById('inv-provident-fund');
    if (pfInput && !pfInput._manualOverride) {
        pfInput.value = annPFEmployee || '';
    }

    // ── 4. Update PF display ──
    const pfEmpEl = document.getElementById('pf-employee');
    if (pfEmpEl) pfEmpEl.textContent = formatTaka(annPFEmployee);
    
    const pfRebEl = document.getElementById('pf-rebate-eligible');
    if (pfRebEl) pfRebEl.textContent = formatTaka(annPFEmployee);

    // ── 5. Gross & Taxable income ──
    // Gross Income = Salary + Bonuses + Other Income (PF is excluded per instructions)
    const grossIncome  = annGrossSalary + otherIncome;
    
    // Exemption: Standard NBR rule is min(4.5L, 1/3 of Total Salary).
    const salaryThird = Math.round(annGrossSalary * (1/3));
    const allowanceExemption = Math.min(C.MAX_ALLOWANCE_EXEMPTION, salaryThird);
    
    const taxableIncome = Math.max(0, grossIncome - allowanceExemption);

    // Tax-free threshold
    let taxFreeLimit = C.TAX_FREE_LIMITS[taxpayerType] || C.TAX_FREE_LIMITS.general;
    taxFreeLimit += disabledChildCount * C.DISABLED_CHILD_EXTRA;

    // ── 6. Office Paid Tax (Tax on Basic Only) ──
    const officeSlabDetails = computeSlabs(annBasic, taxFreeLimit);
    const officePaidTax = officeSlabDetails.totalTax;

    // ── 7. Investment inputs (14 categories) ──
    const invLifeInsurance   = getVal('inv-life-insurance');
    const invPF              = getVal('inv-provident-fund');  // auto-filled
    const invGPF             = getVal('inv-gpf');
    const invSuperannuation  = getVal('inv-superannuation');
    const invBenevolent      = getVal('inv-benevolent');
    const invSanchaypatra    = getVal('inv-sanchaypatra');
    const invDPS             = Math.min(getVal('inv-dps'), C.DPS_ANNUAL_LIMIT);
    const invShares          = getVal('inv-shares');
    const invMutual          = getVal('inv-mutual');
    const invPension         = getVal('inv-pension');
    const invCharityHospital = getVal('inv-charity-hospital');
    const invDisability      = getVal('inv-disability');
    const invLiberation      = getVal('inv-liberation');
    const invZakat           = getVal('inv-zakat');

    const totalInvested = invLifeInsurance + invPF + invGPF + invSuperannuation +
        invBenevolent + invSanchaypatra + invDPS + invShares + invMutual +
        invPension + invCharityHospital + invDisability + invLiberation + invZakat;

    // ── 8. Investment rebate calculation ──
    const threePctIncome  = Math.round(taxableIncome * C.MAX_INVESTMENT_INCOME_PCT);
    const tenPctInvest    = Math.round(totalInvested * C.REBATE_RATE);
    const admissibleRebate = Math.min(tenPctInvest, threePctIncome, C.MAX_INVESTMENT_ABSOLUTE);
    const investRebate    = admissibleRebate;

    // ── 9. Gross tax from slabs (on Total Taxable Income) ──
    const slabDetails = computeSlabs(taxableIncome, taxFreeLimit);
    const grossTax = slabDetails.totalTax;

    // ── 10. Net tax after rebate ──
    const taxAfterRebate = Math.max(0, grossTax - investRebate);
    const minimumTax = C.MINIMUM_TAX[areaType] || 0;
    const isAboveThreshold = taxableIncome > taxFreeLimit;
    let netTax = taxAfterRebate;
    let minTaxApplied = false;
    if (isAboveThreshold && taxAfterRebate < minimumTax) {
        netTax = minimumTax;
        minTaxApplied = true;
    }

    // ── 11. Filing quarter adjustment ──
    const qConfig = C.FILING_QUARTERS[filingQuarter] || C.FILING_QUARTERS.q2;
    let earlyFilingRebate = 0, lateSurcharge = 0;
    if (qConfig.rebatePct > 0) {
        earlyFilingRebate = Math.min(Math.round(netTax * qConfig.rebatePct), qConfig.maxRebate);
        netTax = Math.max(isAboveThreshold ? minimumTax : 0, netTax - earlyFilingRebate);
    } else if (qConfig.surcharge > 0) {
        lateSurcharge = Math.max(Math.round(netTax * qConfig.surcharge), qConfig.minSurcharge);
        netTax += lateSurcharge;
    }

    // ── 12. Final Tax Payable ──
    // The office has already paid 'officePaidTax' out of 'netTax'. The rest is up to the user.
    const finalPayable = Math.max(0, netTax - officePaidTax);

    // ── 13. Effective rate & TDS ──
    const effectiveRate = grossIncome > 0 ? (netTax / grossIncome) * 100 : 0;
    const monthlyOfficeTDS = Math.round(officePaidTax / 12);

    // ── 14. Update all UI ──
    updateIncomeStrip(grossIncome, allowanceExemption, taxableIncome);
    updateInvestmentBar(totalInvested, admissibleRebate, threePctIncome);
    updateResultHero({ netTax, finalPayable, monthlyOfficeTDS, grossTax, investRebate, earlyFilingRebate, lateSurcharge, effectiveRate, filingQuarter, qConfig });
    updateOpportunityDashboard({ threePctIncome, totalInvested, investRebate });
    // ── 12. Final step visual & UI updates ──
    updateStepsVisual({
        grossIncome, allowanceExemption, taxableIncome,
        taxFreeLimit, grossTax, investRebate, admissibleRebate,
        threePctIncome, totalInvested, earlyFilingRebate, lateSurcharge,
        netTax, officePaidTax, finalPayable, qConfig, salaryThird
    });

    updateSlabTable('slab-table', slabDetails, taxableIncome, 'Total Gross Tax');
    updateSlabTable('office-slab-table', officeSlabDetails, annBasic, 'Total Office Paid Tax (on Basic)');
    document.getElementById('office-slab-container').style.display = 'block';
    updateInvestmentChart({ totalInvested, admissibleRebate, investRebate, threePctIncome, categories: buildCategoryList({ invLifeInsurance, invPF, invGPF, invSuperannuation, invBenevolent, invSanchaypatra, invDPS: Math.min(getVal('inv-dps'), C.DPS_ANNUAL_LIMIT), invShares, invMutual, invPension, invCharityHospital, invDisability, invLiberation, invZakat }) });
    updateComputationTable({ totalSalary, festivalBonusAmt, perfBonusAmt, annGrossSalary, otherIncome, grossIncome, allowanceExemption, taxableIncome, taxFreeLimit, grossTax, investRebate, admissibleRebate, netTax, minTaxApplied, minimumTax, earlyFilingRebate, lateSurcharge, officePaidTax, finalPayable, qConfig, salaryThird });
    updateMinTaxCard(minTaxApplied, areaType, grossTax, investRebate, minimumTax);
    updateTips({ taxableIncome, totalInvested, threePctIncome, investRebate, netTax, earlyFilingRebate, filingQuarter, grossTax });
}

// Mark PF field as manually overridden if user types in it
document.addEventListener('DOMContentLoaded', () => {
    const pfInput = document.getElementById('inv-provident-fund');
    if (pfInput) {
        pfInput.addEventListener('input', () => { pfInput._manualOverride = pfInput.value !== ''; });
    }
});

// ════════════════════════════════════════════════
// SLAB CALCULATION
// ════════════════════════════════════════════════
function computeSlabs(taxableIncome, taxFreeLimit) {
    const slabs = [];
    let remaining = Math.max(0, taxableIncome - taxFreeLimit);
    let totalTax = 0;

    slabs.push({ label: 'Tax-Free Threshold', rate: '0%', applicable: Math.min(taxableIncome, taxFreeLimit), tax: 0, active: taxableIncome >= taxFreeLimit });

    TAX_CONFIG.TAX_SLABS.forEach(slab => {
        if (remaining <= 0) { slabs.push({ label: slab.label, rate: (slab.rate*100)+'%', applicable: 0, tax: 0, active: false }); return; }
        const applicable = slab.limit === Infinity ? remaining : Math.min(remaining, slab.limit);
        const tax = Math.round(applicable * slab.rate);
        totalTax += tax;
        remaining -= applicable;
        slabs.push({ label: slab.label, rate: (slab.rate*100)+'%', applicable, tax, active: true });
    });

    return { slabs, totalTax };
}

// ════════════════════════════════════════════════
// UI UPDATERS
// ════════════════════════════════════════════════

function updateIncomeStrip(gross, exempt, taxable) {
    document.getElementById('strip-gross').textContent   = formatTaka(gross);
    document.getElementById('strip-exempt').textContent  = formatTaka(exempt);
    document.getElementById('strip-taxable').textContent = formatTaka(taxable);
}

function updateBreakdownTable(d) {
    // Left intentionally empty or can be removed entirely
    // Breakdown table removed per FinSource rules
}

function updateInvestmentBar(totalInvested, admissibleRebate, threePctIncome) {
    document.getElementById('total-invested').textContent  = formatTaka(totalInvested);
    document.getElementById('admissible-invest').textContent = formatTaka(admissibleRebate);
    const pct = threePctIncome > 0 ? Math.min(100, Math.round((admissibleRebate / threePctIncome) * 100)) : 0;
    document.getElementById('invest-progress').style.width = pct + '%';
}

function updateResultHero({ netTax, finalPayable, monthlyOfficeTDS, grossTax, investRebate, earlyFilingRebate, lateSurcharge, effectiveRate, filingQuarter, qConfig }) {
    animateValue('final-payable-display', finalPayable);
    document.getElementById('net-tax-display').textContent    = formatTaka(netTax);
    document.getElementById('net-tax-monthly').textContent    = `Office Pays: ${formatTaka(monthlyOfficeTDS * 12)} (Tax on Basic)`;
    document.getElementById('gross-tax-display').textContent  = formatTaka(grossTax);
    document.getElementById('rebate-display').textContent     = formatTaka(investRebate + earlyFilingRebate);

    const badge = document.getElementById('filing-quarter-result');
    if (badge) {
        if (earlyFilingRebate > 0) {
            badge.textContent = `🎉 Early Filing Bonus: −${formatTaka(earlyFilingRebate)}`;
            badge.className = 'filing-badge filing-bonus';
            badge.style.display = 'flex';
        } else if (lateSurcharge > 0) {
            badge.textContent = `⚠️ Late Surcharge: +${formatTaka(lateSurcharge)} (${qConfig.label})`;
            badge.className = 'filing-badge filing-penalty';
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

let animTarget = 0;
function animateValue(id, target) {
    const el = document.getElementById(id);
    const start = animTarget;
    animTarget = target;
    const dur = 800, t0 = performance.now();
    const upd = (t) => {
        const p = Math.min((t - t0) / dur, 1);
        const e = 1 - Math.pow(1 - p, 4);
        el.textContent = formatTaka(Math.round(start + (target - start) * e));
        if (p < 1) requestAnimationFrame(upd);
    };
    requestAnimationFrame(upd);
}

function updateOpportunityDashboard({ threePctIncome, totalInvested, investRebate }) {
    const container = document.getElementById('opp-dashboard-container');
    if (!container) return;

    const maxRebatePossible = Math.min(threePctIncome, TAX_CONFIG.MAX_INVESTMENT_ABSOLUTE);
    const maxInvestmentAllowed = maxRebatePossible * 10;
    
    const remainingInvestment = Math.max(0, maxInvestmentAllowed - totalInvested);
    const remainingRebate = Math.max(0, maxRebatePossible - investRebate);

    if (maxRebatePossible <= 0) {
        container.innerHTML = '';
        return;
    }

    let bannerHtml = '';
    if (remainingInvestment > 0) {
        bannerHtml = `
            <div class="opp-banner">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:2px"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                <div>
                    <strong>Action Required:</strong> You are missing out on tax savings! Invest an additional <strong style="color:#fff">${formatTaka(remainingInvestment)}</strong> to claim your maximum rebate of <strong style="color:#fff">${formatTaka(maxRebatePossible)}</strong>.
                </div>
            </div>
        `;
    } else {
        bannerHtml = `
            <div class="opp-banner success">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:2px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <div>
                    <strong>Maximum Rebate Achieved!</strong> You have fully utilized your investment capacity for tax savings.
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="opp-dashboard">
            <div class="opp-header">
                <div class="opp-header-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <div>
                    <div class="opp-title">Tax Savings Opportunity</div>
                    <div class="opp-subtitle">Based on your income and current investments</div>
                </div>
            </div>
            
            <div class="opp-grid">
                <div class="opp-card">
                    <div class="opp-card-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Max Investment Limit
                    </div>
                    <div class="opp-card-value">${formatTaka(maxInvestmentAllowed)}</div>
                    <div class="opp-card-sub">Cap: ${formatTaka(maxRebatePossible)} Rebate</div>
                </div>
                <div class="opp-card ${remainingInvestment > 0 ? 'actionable' : ''}">
                    <div class="opp-card-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                        You Can Invest More
                    </div>
                    <div class="opp-card-value">${formatTaka(remainingInvestment)}</div>
                    <div class="opp-card-sub">${remainingRebate > 0 ? `To get ${formatTaka(remainingRebate)} more rebate` : 'All maxed out!'}</div>
                </div>
            </div>

            ${bannerHtml}
        </div>
    `;
}


function updateStepsVisual({ grossIncome, allowanceExemption, taxableIncome, taxFreeLimit, grossTax, investRebate, admissibleRebate, threePctIncome, totalInvested, earlyFilingRebate, lateSurcharge, netTax, officePaidTax, finalPayable, qConfig, salaryThird }) {
    const container = document.getElementById('steps-visual');
    if (!container) return;

    const steps = [
        { n: 1, cls: 'step-c1', title: 'Annual Gross Income', detail: 'July salary (×1) + Aug–June salary (×11) + Bonuses + Other Income', amount: grossIncome },
        { n: 2, cls: 'step-c2', title: '(−) Allowance Exemption', detail: `min(৳4,50,000 , 1/3 of Total Salary ৳${formatTaka(salaryThird)}) = ${formatTaka(allowanceExemption)}`, amount: -allowanceExemption, isDeduction: true },
        { n: 3, cls: 'step-c3', title: '= Taxable Income', detail: 'Gross Income − Allowance Exemption', amount: taxableIncome, isResult: true },
        { n: 4, cls: 'step-c1', title: '(−) Tax-Free Threshold', detail: `Your category's tax-free limit`, amount: -taxFreeLimit, isDeduction: true },
        { n: 5, cls: 'step-c3', title: 'Gross Tax (from slabs)', detail: 'Progressive slab-wise calculation below', amount: grossTax },
        { n: 6, cls: 'step-c2', title: '(−) Investment Rebate', detail: `10% of admissible (${formatTaka(admissibleRebate)}) | Total invested: ${formatTaka(totalInvested)}`, amount: -investRebate, isDeduction: true },
    ];

    if (earlyFilingRebate > 0) steps.push({ n: 7, cls: 'step-c2', title: '(−) Early Filing Rebate', detail: `5% of net tax (max ৳25,000) — ${qConfig.label}`, amount: -earlyFilingRebate, isDeduction: true });
    if (lateSurcharge > 0)     steps.push({ n: 7, cls: 'step-c4', title: '(+) Late Filing Surcharge', detail: qConfig.label, amount: lateSurcharge });

    steps.push({ n: steps.length + 1, cls: 'step-c5', title: '= TOTAL NET TAX PAYABLE', detail: 'Final tax on all your income', amount: netTax, isResult: true });
    steps.push({ n: steps.length + 2, cls: 'step-c2', title: '(−) Tax Paid By Office', detail: 'Tax calculated on Basic Salary alone', amount: -officePaidTax, isDeduction: true });
    steps.push({ n: steps.length + 3, cls: 'step-c4', title: '= FINAL PAYABLE BY YOU', detail: 'What you need to pay out of pocket', amount: finalPayable, isFinal: true, isResult: true });

    container.innerHTML = steps.map((s, i) => `
        <div class="step-item">
            <div class="step-line-col">
                <div class="step-circle ${s.cls}">${s.n}</div>
                ${i < steps.length - 1 ? '<div class="step-connector"></div>' : ''}
            </div>
            <div class="step-body">
                <div class="step-title" style="${s.isFinal ? 'color:var(--accent-green);font-size:14px' : ''}">
                    ${s.title}
                    <span class="step-amount" style="color:${s.isDeduction ? 'var(--accent-green)' : s.isFinal ? 'var(--accent-green)' : 'var(--text-primary)'}">${s.isDeduction ? '−' : ''}${formatTaka(Math.abs(s.amount))}</span>
                </div>
                <div class="step-detail">${s.detail}</div>
            </div>
        </div>
    `).join('');
}

function updateSlabTable(containerId, slabDetails, taxableIncome, totalLabel) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const hdr = document.createElement('div');
    hdr.className = 'slab-row slab-row-header';
    hdr.innerHTML = '<span>Tax Slab</span><span style="text-align:right">Rate</span><span style="text-align:right">Tax Amount</span><span style="text-align:right">Applied On</span>';
    container.appendChild(hdr);

    slabDetails.slabs.forEach(s => {
        const row = document.createElement('div');
        row.className = 'slab-row' + (s.active ? ' active' : '');
        row.innerHTML = `<span class="slab-range">${s.label}</span><span class="slab-rate">${s.rate}</span><span class="slab-tax-amount">${s.tax > 0 ? formatTaka(s.tax) : '—'}</span><span class="slab-applicable">${s.applicable > 0 ? formatTaka(s.applicable) : '—'}</span>`;
        container.appendChild(row);
    });

    const tot = document.createElement('div');
    tot.className = 'slab-row';
    tot.style.cssText = 'background:rgba(245,158,11,0.1);border-color:rgba(245,158,11,0.3);font-weight:700;margin-top:4px';
    tot.innerHTML = `<span style="color:var(--accent-amber)">${totalLabel}</span><span></span><span class="slab-tax-amount" style="color:var(--accent-amber)">${formatTaka(slabDetails.totalTax)}</span><span class="slab-applicable" style="color:var(--accent-amber)">${formatTaka(taxableIncome)}</span>`;
    container.appendChild(tot);
}

function buildCategoryList(inv) {
    return [
        { name: '🛡️ Life Insurance',      amount: inv.invLifeInsurance },
        { name: '🏦 Provident Fund (RPF)', amount: inv.invPF },
        { name: '🏛️ GPF',                  amount: inv.invGPF },
        { name: '🎯 Superannuation',       amount: inv.invSuperannuation },
        { name: '🤝 Benevolent/Group Ins.',amount: inv.invBenevolent },
        { name: '📜 Sanchayapatra/Govt Sec',amount: inv.invSanchaypatra },
        { name: '💰 DPS (max ৳1.2L)',     amount: inv.invDPS },
        { name: '📈 Listed Shares (DSE/CSE)',amount: inv.invShares },
        { name: '📊 Mutual Funds',         amount: inv.invMutual },
        { name: '🏅 Universal Pension',    amount: inv.invPension },
        { name: '🏥 Charity Hospital',     amount: inv.invCharityHospital },
        { name: '♿ Disabled Welfare',     amount: inv.invDisability },
        { name: '🏳️ Liberation/Bangabandhu',amount: inv.invLiberation },
        { name: '🕌 Zakat Fund',           amount: inv.invZakat },
    ].filter(c => c.amount > 0);
}

function updateInvestmentChart({ totalInvested, admissibleRebate, investRebate, threePctIncome, categories }) {
    const container = document.getElementById('inv-chart');
    if (!container) return;

    const maxInvestmentCap = threePctIncome / 0.10;
    const maxCap = Math.max(maxInvestmentCap, totalInvested, 1);

    let html = '';

    // Overall bar
    html += `<div class="inv-chart-row">
        <div class="inv-chart-label">
            <span class="inv-chart-name" style="font-weight:700;color:var(--text-primary)">Overall Investment Capacity</span>
            <span class="inv-chart-amt">${formatTaka(maxInvestmentCap)} cap</span>
        </div>
        <div class="inv-bar-track" style="height:14px;border-radius:8px">
            <div class="inv-bar-fill bar-capacity" style="width:100%;position:absolute;opacity:0.3;border-radius:8px;height:14px"></div>
            <div class="inv-bar-fill bar-invested" style="width:${Math.min(100,(totalInvested/Math.max(maxInvestmentCap,1))*100).toFixed(1)}%;height:14px"></div>
        </div>
        <div class="inv-chart-label" style="margin-top:5px;font-size:11px;color:var(--text-muted)">
            <span>You invested: <strong style="color:var(--accent-green)">${formatTaka(totalInvested)}</strong></span>
            <span>Rebate earned: <strong style="color:var(--accent-amber)">${formatTaka(investRebate)}</strong></span>
            <span>Remaining: <strong style="color:var(--accent-red)">${formatTaka(Math.max(0, maxInvestmentCap - totalInvested))}</strong> to invest</span>
        </div>
    </div>`;

    // Capacity vs Rebate summary
    html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:10px 0 14px;padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid var(--border)">
        <div style="text-align:center">
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px">Max Rebate Cap</div>
            <div style="font-size:15px;font-weight:800;color:#a5b4fc">${formatTaka(threePctIncome)}</div>
            <div style="font-size:10px;color:var(--text-muted)">Max admissible rebate</div>
        </div>
        <div style="text-align:center;border-left:1px solid var(--border)">
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px">Your Investment</div>
            <div style="font-size:15px;font-weight:800;color:var(--accent-green)">${formatTaka(totalInvested)}</div>
            <div style="font-size:10px;color:var(--text-muted)">Total invested</div>
        </div>
        <div style="text-align:center;border-left:1px solid var(--border)">
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px">Rebate Earned</div>
            <div style="font-size:15px;font-weight:800;color:var(--accent-amber)">${formatTaka(investRebate)}</div>
            <div style="font-size:10px;color:var(--text-muted)">10% of admissible</div>
        </div>
    </div>`;

    // Per-category bars
    if (categories.length > 0) {
        html += '<div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px">By Investment Category</div>';
        categories.forEach(cat => {
            const pct = Math.min(100, (cat.amount / maxCap) * 100).toFixed(1);
            html += `<div class="inv-chart-row" style="margin-bottom:8px">
                <div class="inv-chart-label">
                    <span class="inv-chart-name">${cat.name}</span>
                    <span class="inv-chart-amt">${formatTaka(cat.amount)}</span>
                </div>
                <div class="inv-bar-track">
                    <div class="inv-bar-fill bar-invested" style="width:${pct}%"></div>
                </div>
            </div>`;
        });
    } else {
        html += '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px">No investments entered yet. Add investments above to see your rebate chart.</div>';
    }

    container.innerHTML = html;
}


function updateComputationTable({ totalSalary, festivalBonusAmt, perfBonusAmt, annGrossSalary, otherIncome, grossIncome, allowanceExemption, taxableIncome, taxFreeLimit, grossTax, investRebate, admissibleRebate, netTax, minTaxApplied, minimumTax, earlyFilingRebate, lateSurcharge, officePaidTax, finalPayable, qConfig, salaryThird }) {
    const container = document.getElementById('computation-table');
    container.innerHTML = '';

    const rows = [
        { label: 'A. INCOME COMPUTATION', isHeader: true },
        { label: 'Total Base Salary (Annual)', value: totalSalary },
        { label: 'Festival Bonuses', value: festivalBonusAmt, indent: true },
        { label: 'Performance Bonuses', value: perfBonusAmt, indent: true },
        { label: 'Total Salary Income', value: annGrossSalary, isSubtotal: true },
        { label: 'Other Income', value: otherIncome },
        { label: 'TOTAL GROSS INCOME', value: grossIncome, isSubtotal: true },
        { label: `Less: Allowance Exemption (min of ৳4,50,000 / 1/3 Total Salary ৳${formatTaka(salaryThird)})`, value: -allowanceExemption, isDeduction: true },
        { label: 'TAXABLE INCOME', value: taxableIncome, isTotal: true },
        { label: 'Less: Tax-Free Threshold', value: -taxFreeLimit, isDeduction: true },
        { label: '', isDivider: true },
        { label: 'B. TAX CALCULATION', isHeader: true },
        { label: 'Gross Tax (Slab-wise)', value: grossTax },
        { label: 'Less: Investment Rebate (10% of admissible)', value: -investRebate, isDeduction: true },
        { label: 'Tax After Investment Rebate', value: Math.max(0, grossTax - investRebate), isSubtotal: true },
        minTaxApplied ? { label: `⚠ Minimum Tax Applied (${formatTaka(minimumTax)})`, value: minimumTax, note: true } : null,
        earlyFilingRebate > 0 ? { label: '🎉 Early Filing Rebate (Jul–Sep 5%, max ৳25,000)', value: -earlyFilingRebate, isDeduction: true } : null,
        lateSurcharge > 0 ? { label: `⚠ Late Filing Surcharge (${qConfig.label})`, value: lateSurcharge, isSurcharge: true } : null,
        { label: 'TOTAL NET TAX', value: netTax, isSubtotal: true },
        { label: 'Less: Tax Paid by Office (Computed on Basic)', value: -officePaidTax, isDeduction: true },
        { label: 'FINAL PAYABLE BY YOU', value: finalPayable, isTotal: true },
    ].filter(Boolean);

    rows.forEach(row => {
        if (row.isDivider) {
            const d = document.createElement('div');
            d.style.cssText = 'height:1px;background:var(--border);margin:4px 0';
            container.appendChild(d);
            return;
        }
        const el = document.createElement('div');
        el.className = ['comp-row', row.isHeader?'header':'', row.isTotal?'total':'', row.isSubtotal?'subtotal':'', row.isDeduction?'deduction':'', row.isSurcharge?'surcharge':'', row.indent?'indent':''].filter(Boolean).join(' ');
        if (row.isHeader) {
            el.innerHTML = `<span class="comp-label" style="font-size:10px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">${row.label}</span>`;
        } else {
            const valAbs = formatTaka(Math.abs(row.value || 0));
            const valClass = row.value < 0 ? 'comp-value negative' : row.isTotal ? 'comp-value total-val' : 'comp-value';
            const prefix = row.value < 0 ? '(−) ' : '';
            el.innerHTML = `<span class="comp-label">${row.label}</span>${row.value !== undefined ? `<span class="${valClass}">${prefix}${valAbs}</span>` : ''}`;
        }
        container.appendChild(el);
    });
}

function updateMinTaxCard(applied, areaType, grossTax, investRebate, minimumTax) {
    const card = document.getElementById('min-tax-card');
    const areaLabels = { dhaka_ctg: 'Dhaka N/S or Chattogram CC (৳5,000)', other_city: 'Other City Corp. (৳4,000)', outside_city: 'Outside City Corp. (৳3,000)' };
    if (applied) {
        card.style.display = 'flex';
        document.getElementById('min-tax-reason').textContent = `Calculated tax (${formatTaka(Math.max(0, grossTax - investRebate))}) is below the minimum for ${areaLabels[areaType]}`;
    } else {
        card.style.display = 'none';
    }
}

function updateTips({ taxableIncome, totalInvested, threePctIncome, investRebate, netTax, earlyFilingRebate, filingQuarter, grossTax }) {
    const list = document.getElementById('tips-list');
    list.innerHTML = '';
    const tips = [];

    if (filingQuarter === 'q2') tips.push('🎉 Switch your filing quarter to "July–September" to get a 5% rebate on your net tax (up to ৳25,000)!');
    else if (filingQuarter === 'q1' && earlyFilingRebate > 0) tips.push(`✅ Great! Filing early saves you ${formatTaka(earlyFilingRebate)} extra on top of your investment rebate.`);
    else if (filingQuarter === 'q3') tips.push('⚠️ Filing Jan–Mar means a 2% surcharge. File earlier next year (Jul–Sep) to get a 5% discount instead!');
    else if (filingQuarter === 'q4') tips.push('🚨 Filing Apr–Jun incurs 5% surcharge. File by September next year to save significant money!');

    if (totalInvested === 0 && taxableIncome > 375000) {
        tips.push('💡 No investments yet! With your income, you can potentially save tax. Start with PF, DPS (max ৳1,20,000/year), or Sanchayapatra.');
    }

    const maxRebatePossible = Math.min(threePctIncome, TAX_CONFIG.MAX_INVESTMENT_ABSOLUTE);
    if (threePctIncome > 0 && investRebate < maxRebatePossible) {
        const unusedRebate = maxRebatePossible - investRebate;
        tips.push(`📊 You can earn up to ${formatTaka(unusedRebate)} more in investment rebate. Your 3%-of-income cap is ${formatTaka(threePctIncome)} (max ৳7,50,000).`);
    }

    if (investRebate > 0) tips.push(`✅ Investment rebate saves you ${formatTaka(investRebate)} tax — that's 10% of your admissible investments.`);

    tips.push('📝 File your e-Return at etaxnbr.gov.bd. Online filing is now mandatory for most taxpayers.');
    tips.push('📂 Keep receipts for all investments: DPS passbook, Sanchayapatra certificates, life insurance premium receipts, and PF statements.');

    tips.forEach(tip => {
        const li = document.createElement('li');
        li.textContent = tip;
        list.appendChild(li);
    });
}

// ════════════════════════════════════════════════
// PRINT
// ════════════════════════════════════════════════
function printReport() {
    const now = new Date().toLocaleDateString('en-BD', { day:'numeric', month:'long', year:'numeric' });
    const netTax  = document.getElementById('final-payable-display').textContent;
    const gross   = document.getElementById('strip-gross').textContent;
    const taxable = document.getElementById('strip-taxable').textContent;
    const rebate  = document.getElementById('rebate-display').textContent;
    const rate    = document.getElementById('net-tax-display').textContent;
    const compHTML = document.getElementById('computation-table').innerHTML;
    const slabHTML = document.getElementById('slab-table').innerHTML;
    const tdsHTML  = document.getElementById('tds-table').outerHTML;
    const monthlyTDS = document.getElementById('tds-monthly-display').textContent;

    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bangladesh Tax Report FY 2025-26</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;background:#fff;color:#111;padding:40px;max-width:800px;margin:0 auto}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #10b981}
    h1{font-size:22px;font-weight:800}p{font-size:13px;color:#555;margin-top:4px}.badge{display:inline-block;padding:3px 10px;background:#d1fae5;color:#065f46;border-radius:20px;font-size:11px;font-weight:700;margin-top:4px}
    .grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:28px}
    .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center}
    .box.hl{background:#f0fdf4;border-color:#86efac}.lbl{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:5px}
    .val{font-size:18px;font-weight:800}.val.g{color:#059669}.val.a{color:#d97706}
    h2{font-size:14px;font-weight:700;color:#334155;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;margin-top:20px}
    .comp-row{display:flex;justify-content:space-between;padding:7px 10px;font-size:12.5px;border-bottom:1px solid #f1f5f9}
    .comp-row.header{background:#f1f5f9;font-weight:800;font-size:10px;text-transform:uppercase;color:#64748b}
    .comp-row.total{background:#f0fdf4;border:1px solid #86efac;border-radius:6px;font-weight:800;color:#065f46;margin-top:6px}
    .comp-row.subtotal{font-weight:700;color:#d97706}.comp-row.deduction{color:#059669}.comp-row.indent{padding-left:22px}
    .comp-row.surcharge{color:#ef4444;font-weight:600}
    .slab-row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:6px;padding:7px 10px;font-size:11.5px;border-bottom:1px solid #f1f5f9}
    .slab-row.active{background:#f0fdf4}.slab-row-header{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;background:#f1f5f9}
    .slab-rate{text-align:right;font-weight:700;color:#d97706}.slab-tax-amount,.slab-applicable{text-align:right}
    .tds-table{width:100%;border-collapse:collapse;font-size:12px}.tds-table th{padding:7px 10px;background:#f1f5f9;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;text-align:right}
    .tds-table th:first-child{text-align:left}.tds-table td{padding:7px 10px;border-bottom:1px solid #f1f5f9;text-align:right}.tds-table td:first-child{text-align:left;font-weight:500}
    .tds-table tfoot td{font-weight:700;background:#f0fdf4;color:#059669}
    .footer{margin-top:32px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.6}
    @media print{body{padding:20px}}</style></head><body>
    <div class="hdr"><div><h1>Income Tax Computation Statement</h1><p>FinSource Tax Calculator — National Board of Revenue, Bangladesh</p><span class="badge">FY 2025-26 | NBR Compliant</span></div><div style="text-align:right;font-size:12px;color:#777"><p>Generated on:</p><p><strong>${now}</strong></p></div></div>
    <div class="grid">
        <div class="box"><div class="lbl">Gross Income</div><div class="val">${gross}</div></div>
        <div class="box"><div class="lbl">Total Net Tax</div><div class="val a">${rate}</div></div>
        <div class="box"><div class="lbl">Investment Rebate</div><div class="val g">${rebate}</div></div>
        <div class="box hl"><div class="lbl">Final Payable By You</div><div class="val">${netTax}</div></div>
    </div>
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px 16px;margin-bottom:20px">
        <strong style="color:#065f46">Monthly Tax Paid By Office: ${monthlyTDS}</strong> — The office calculates tax on your basic salary and pays it for you.
    </div>
    <h2>Income & Tax Computation</h2>${compHTML.replace(/class="comp-row/g,'class="comp-row')}
    <h2>Tax Slab Breakdown</h2>${slabHTML}
    <h2>Monthly TDS Schedule</h2>${tdsHTML}
    <div class="footer"><p>This report is for reference purposes only. For official tax assessment, consult the NBR or a registered tax advisor.</p><p>Official e-Return portal: etaxnbr.gov.bd | NBR Helpline: 09643717171</p></div>
    <button onclick="window.print()" style="margin:20px auto;display:block;padding:10px 28px;background:#10b981;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Print / Save as PDF</button>
    </body></html>`);
    w.document.close();
}

// ════════════════════════════════════════════════
// RESET
// ════════════════════════════════════════════════
function resetForm() {
    document.querySelectorAll('input[type="number"]').forEach(el => { el.value = ''; el._manualOverride = false; });
    document.getElementById('taxpayer-type').value = 'general';
    document.getElementById('area-type').value     = 'dhaka_ctg';
    document.getElementById('filing-quarter').value= 'q2';
    document.getElementById('disabled-child').checked = false;
    document.getElementById('child-count-row').style.display = 'none';
    document.getElementById('festival-bonus-amt').value = '';
    document.getElementById('perf-bonus-amt').value = '';
    animTarget = 0;
    calculate();
}
