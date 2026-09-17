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
 * Updated NBR 2025-26 Rules:
 *  - Rebate Rate: 10% of actual investment
 *  - Max Rebate = min(3% of taxable income, 10% of actual investment, ৳7,50,000)
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
        general:        400000,
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

    // Investment rebate
    REBATE_RATE:              0.10,   // 10% of actual investment
    MAX_INVESTMENT_INCOME_PCT:0.03,   // 3% of taxable income
    MAX_INVESTMENT_ABSOLUTE:  750000, // ৳7,50,000 ceiling

    // DPS annual limit
    DPS_ANNUAL_LIMIT: 120000,

    // Sanchayapatra annual investment limit eligible for rebate
    SANCHAYPATRA_ANNUAL_LIMIT: 500000,

    // Consolidated allowance exemption
    MAX_ALLOWANCE_EXEMPTION:  500000,
    ALLOWANCE_BASIC_PCT:      1/3,

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

// Editable rule overrides fall back to the NBR defaults in TAX_CONFIG.
function getSetting(id, fallback) {
    const el = document.getElementById(id);
    if (!el || el.value === '') return fallback;
    const v = parseFloat(el.value);
    return isNaN(v) || v < 0 ? fallback : v;
}

// ════════════════════════════════════════════════
// EVENT SETUP
// ════════════════════════════════════════════════
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('disabled-child').addEventListener('change', function() {
            document.getElementById('child-count-row').style.display = this.checked ? 'block' : 'none';
            calculate();
        });
        calculate();
    });
}

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
// PURE CALCULATION CORE (no DOM — used by UI and tests)
// ════════════════════════════════════════════════
const INVESTMENT_KEYS = [
    'lifeInsurance', 'providentFund', 'gpf', 'superannuation', 'benevolent',
    'sanchaypatra', 'dps', 'shares', 'mutual', 'pension',
    'charityHospital', 'disability', 'liberation', 'zakat',
];

function pick(value, fallback) {
    return (value === undefined || value === null || isNaN(value)) ? fallback : value;
}

/**
 * Computes the full tax breakdown from plain numbers.
 * Every rule here mirrors Plan.txt + NBR FY 2025-26; the UI is only a thin wrapper.
 */
function computeTax(input = {}) {
    const C = TAX_CONFIG;

    // ── 1. Normalise inputs ──
    const taxpayerType       = input.taxpayerType || 'general';
    const areaType           = input.areaType || 'dhaka_ctg';
    const disabledChildCount = pick(input.disabledChildCount, 0);
    const otherIncome        = pick(input.otherIncome, 0);
    const julyGross          = pick(input.julyGross, 0);
    const augGross           = pick(input.augGross, 0);
    const augMonths          = pick(input.augMonths, 11);
    const extraDaysCount     = pick(input.extraDaysCount, 0);
    const festivalBonusCount = pick(input.festivalBonusCount, 0);
    const perfBonusCount     = pick(input.perfBonusCount, 0);

    const rebateRate        = pick(input.rebateRate, C.REBATE_RATE);
    const maxInvestAbsolute = pick(input.maxInvestAbsolute, C.MAX_INVESTMENT_ABSOLUTE);
    const dpsLimit          = pick(input.dpsLimit, C.DPS_ANNUAL_LIMIT);
    const sanchaypatraLimit = pick(input.sanchaypatraLimit, C.SANCHAYPATRA_ANNUAL_LIMIT);

    // ── 2. Salary ──
    // Extra days: first 2 days at the July (pre-increment) rate, the rest at the Aug–June rate.
    const julyExtraDays   = Math.min(2, extraDaysCount);
    const augExtraDays    = Math.max(0, extraDaysCount - 2);
    const extraDaysSalary = Math.round((julyGross / 30) * julyExtraDays + (augGross / 30) * augExtraDays);

    const defaultFestivalBonus = Math.round(augGross * 0.60 * festivalBonusCount);
    const defaultPerfBonus     = perfBonusCount > 0
        ? Math.round((julyGross * 0.20) + (augGross * 0.20 * (perfBonusCount - 1)))
        : 0;
    const festivalBonusAmt = pick(input.festivalBonusAmt, defaultFestivalBonus);
    const perfBonusAmt     = pick(input.perfBonusAmt, defaultPerfBonus);

    const totalSalary    = julyGross + (augGross * augMonths) + extraDaysSalary;
    const annGrossSalary = totalSalary + festivalBonusAmt + perfBonusAmt;

    // Basic is only used for the Office Paid Tax base and PF.
    const annBasic = Math.round(julyGross * C.SALARY_BASIC_PCT) + Math.round(augGross * C.SALARY_BASIC_PCT) * augMonths;

    // ── 3. Provident Fund ──
    const defaultPFEmployee = Math.round(julyGross * C.PF_EMPLOYEE_PCT) + Math.round(augGross * C.PF_EMPLOYEE_PCT) * augMonths;
    const defaultPFOffice   = Math.round(julyGross * C.PF_OFFICE_PCT) + Math.round(augGross * C.PF_OFFICE_PCT) * augMonths;
    const annPFEmployee = pick(input.pfEmployee, defaultPFEmployee);
    const annPFOffice   = pick(input.pfOffice, defaultPFOffice);
    const totalPF = annPFEmployee + annPFOffice;

    // ── 4. Gross & taxable income ──
    const grossIncome  = annGrossSalary + otherIncome + annPFOffice;
    const salaryThird  = Math.round(grossIncome * (1 / 3));
    const allowanceExemption = Math.min(C.MAX_ALLOWANCE_EXEMPTION, salaryThird);
    const taxableIncome = Math.max(0, grossIncome - allowanceExemption);

    let taxFreeLimit = C.TAX_FREE_LIMITS[taxpayerType] || C.TAX_FREE_LIMITS.general;
    taxFreeLimit += disabledChildCount * C.DISABLED_CHILD_EXTRA;

    // ── 5. Office tax base = Basic + the employee's own PF contribution ──
    const officeTaxBase = annBasic + annPFEmployee;
    const officeSlabDetails = computeSlabs(officeTaxBase, taxFreeLimit);
    const taxOnBasic = officeSlabDetails.totalTax;

    // ── 6. Investments (capped categories: DPS and Sanchayapatra) ──
    const raw = input.investments || {};
    const investments = {};
    INVESTMENT_KEYS.forEach(k => { investments[k] = pick(raw[k], 0); });
    investments.providentFund = pick(raw.providentFund, totalPF);
    investments.dps           = Math.min(investments.dps, dpsLimit);
    investments.sanchaypatra  = Math.min(investments.sanchaypatra, sanchaypatraLimit);

    const totalInvested = INVESTMENT_KEYS.reduce((sum, k) => sum + investments[k], 0);

    // ── 7. Investment rebate ──
    const threePctIncome    = Math.round(taxableIncome * C.MAX_INVESTMENT_INCOME_PCT);
    const maxRebatePossible = Math.min(threePctIncome, maxInvestAbsolute);
    const pctInvest         = Math.round(totalInvested * rebateRate);
    const admissibleRebate  = Math.min(pctInvest, maxRebatePossible);
    const investRebate      = admissibleRebate;

    // ── 8. Gross tax from slabs ──
    const slabDetails = computeSlabs(taxableIncome, taxFreeLimit);
    const grossTax = slabDetails.totalTax;

    // ── 9. Office paid tax ──
    const minimumTax = C.MINIMUM_TAX[areaType] || 0;
    const isAboveThreshold = taxableIncome > taxFreeLimit;
    // Office assumes the employee will invest up to the maximum rebate capacity.
    const assumedNetTaxByOffice = Math.max(0, grossTax - maxRebatePossible);
    let officePaidTax = Math.min(taxOnBasic, assumedNetTaxByOffice);
    let officeMinTaxApplied = false;
    if (isAboveThreshold && assumedNetTaxByOffice < minimumTax) {
        officePaidTax = minimumTax;
        officeMinTaxApplied = true;
    }

    // ── 10. Net tax after rebate ──
    const taxAfterRebate = Math.max(0, grossTax - investRebate);
    let netTax = taxAfterRebate;
    let minTaxApplied = false;
    if (isAboveThreshold && taxAfterRebate < minimumTax) {
        netTax = minimumTax;
        minTaxApplied = true;
    }

    const finalPayable     = Math.max(0, netTax - officePaidTax);
    const effectiveRate    = grossIncome > 0 ? (netTax / grossIncome) * 100 : 0;
    const monthlyOfficeTDS = Math.round(officePaidTax / 12);

    return {
        extraDaysSalary, festivalBonusAmt, perfBonusAmt, defaultFestivalBonus, defaultPerfBonus,
        totalSalary, annGrossSalary, annBasic,
        defaultPFEmployee, defaultPFOffice, annPFEmployee, annPFOffice, totalPF,
        otherIncome, grossIncome, salaryThird, allowanceExemption, taxableIncome, taxFreeLimit,
        officeTaxBase, officeSlabDetails, taxOnBasic,
        investments, totalInvested,
        threePctIncome, maxRebatePossible, admissibleRebate, investRebate,
        slabDetails, grossTax,
        minimumTax, assumedNetTaxByOffice, officePaidTax, officeMinTaxApplied,
        taxAfterRebate, netTax, minTaxApplied,
        finalPayable, effectiveRate, monthlyOfficeTDS, augMonths,
    };
}

// ════════════════════════════════════════════════
// MAIN CALCULATION
// ════════════════════════════════════════════════
let currentDisplayValue = 0;

function calculate() {
    // ── 1. Read inputs ──
    const taxpayerType   = document.getElementById('taxpayer-type').value;
    const areaType       = document.getElementById('area-type').value;
    const hasDisabledChild   = document.getElementById('disabled-child').checked;
    const disabledChildCount = hasDisabledChild ? (parseInt(document.getElementById('disabled-child-count').value) || 1) : 0;

    const C = TAX_CONFIG;
    const festEl = document.getElementById('festival-bonus-amt');
    const perfEl = document.getElementById('perf-bonus-amt');
    const pfEmployeeInput = document.getElementById('pf-employee-input');
    const pfOfficeInput   = document.getElementById('pf-office-input');
    const pfInput         = document.getElementById('inv-provident-fund');

    const result = computeTax({
        taxpayerType,
        areaType,
        disabledChildCount,
        otherIncome: getVal('other-income'),
        julyGross:   getVal('july-gross'),
        augGross:    getVal('aug-gross'),
        augMonths:   parseInt(document.getElementById('aug-months')?.value) || 11,
        extraDaysCount: parseInt(document.getElementById('extra-days-count')?.value) || 16,
        festivalBonusCount: parseInt(document.getElementById('festival-bonus-count')?.value ?? '2') || 0,
        perfBonusCount:     parseInt(document.getElementById('perf-bonus-count')?.value ?? '2') || 0,
        festivalBonusAmt: festEl?._manualOverride ? getVal('festival-bonus-amt') : undefined,
        perfBonusAmt:     perfEl?._manualOverride ? getVal('perf-bonus-amt') : undefined,
        pfEmployee: pfEmployeeInput?._manualOverride ? getVal('pf-employee-input') : undefined,
        pfOffice:   pfOfficeInput?._manualOverride   ? getVal('pf-office-input')   : undefined,
        rebateRate:        getSetting('rebate-rate-pct', C.REBATE_RATE * 100) / 100,
        maxInvestAbsolute: getSetting('rebate-max-absolute', C.MAX_INVESTMENT_ABSOLUTE),
        dpsLimit:          getSetting('dps-annual-limit', C.DPS_ANNUAL_LIMIT),
        sanchaypatraLimit: getSetting('sanchaypatra-annual-limit', C.SANCHAYPATRA_ANNUAL_LIMIT),
        investments: {
            lifeInsurance:   getVal('inv-life-insurance'),
            providentFund:   pfInput?._manualOverride ? getVal('inv-provident-fund') : undefined,
            gpf:             getVal('inv-gpf'),
            superannuation:  getVal('inv-superannuation'),
            benevolent:      getVal('inv-benevolent'),
            sanchaypatra:    getVal('inv-sanchaypatra'),
            dps:             getVal('inv-dps'),
            shares:          getVal('inv-shares'),
            mutual:          getVal('inv-mutual'),
            pension:         getVal('inv-pension'),
            charityHospital: getVal('inv-charity-hospital'),
            disability:      getVal('inv-disability'),
            liberation:      getVal('inv-liberation'),
            zakat:           getVal('inv-zakat'),
        },
    });

    const {
        extraDaysSalary, festivalBonusAmt, perfBonusAmt, totalSalary, annGrossSalary, annBasic,
        annPFEmployee, annPFOffice, totalPF, otherIncome, grossIncome, salaryThird,
        allowanceExemption, taxableIncome, taxFreeLimit, officeTaxBase, officeSlabDetails, taxOnBasic,
        investments, totalInvested, threePctIncome, maxRebatePossible, admissibleRebate, investRebate,
        slabDetails, grossTax, minimumTax, assumedNetTaxByOffice, officePaidTax, officeMinTaxApplied,
        netTax, minTaxApplied, finalPayable, effectiveRate, monthlyOfficeTDS, augMonths,
    } = result;

    // ── 2. Write derived defaults back into the form ──
    const extraDaysEl = document.getElementById('extra-days-salary');
    if (extraDaysEl) extraDaysEl.value = extraDaysSalary || '';

    const augLbl = document.getElementById('aug-months-label');
    if (augLbl) augLbl.textContent = augMonths;

    if (festEl) festEl.value = festivalBonusAmt || '';
    if (perfEl) perfEl.value = perfBonusAmt || '';
    if (pfEmployeeInput && !pfEmployeeInput._manualOverride) pfEmployeeInput.value = annPFEmployee || '';
    if (pfOfficeInput && !pfOfficeInput._manualOverride) pfOfficeInput.value = annPFOffice || '';
    if (pfInput && !pfInput._manualOverride) pfInput.value = totalPF || '';

    const pfRebEl = document.getElementById('pf-rebate-eligible');
    if (pfRebEl) pfRebEl.textContent = formatTaka(totalPF);

    // ── 3. Update all UI ──
    updateIncomeStrip(grossIncome, allowanceExemption, taxableIncome);
    updateInvestmentBar(totalInvested, admissibleRebate, threePctIncome);
    updateResultHero({ netTax, finalPayable, monthlyOfficeTDS, grossTax, investRebate, effectiveRate, officePaidTax, taxOnBasic, officeMinTaxApplied });
    updateOpportunityDashboard({ threePctIncome, totalInvested, investRebate, grossIncome, taxableIncome, allowanceExemption });
    
    updateStepsVisual({
        grossIncome, allowanceExemption, taxableIncome,
        taxFreeLimit, grossTax, investRebate, admissibleRebate, threePctIncome, totalInvested,
        netTax, officePaidTax, finalPayable, salaryThird, augMonths, annBasic, officeTaxBase, annPFEmployee, annPFOffice, taxOnBasic, maxRebatePossible, assumedNetTaxByOffice
    });

    updateSlabTable('slab-table', slabDetails, taxableIncome, 'Total Gross Tax');
    updateSlabTable('office-slab-table', officeSlabDetails, officeTaxBase, `Tax Computed on Basic + Employee PF (${formatTaka(officeTaxBase)})`);
    const officeHeader = document.getElementById('office-slab-title-header');
    if (officeHeader) officeHeader.textContent = `Office Paid Tax Slab (Basic + Employee PF: ${formatTaka(officeTaxBase)})`;
    document.getElementById('office-slab-container').style.display = 'block';
    updateInvestmentChart({ totalInvested, admissibleRebate, investRebate, threePctIncome, categories: buildCategoryList(investments) });
    updateComputationTable({ totalSalary, extraDaysSalary, festivalBonusAmt, perfBonusAmt, annGrossSalary, otherIncome, grossIncome, allowanceExemption, taxableIncome, taxFreeLimit, grossTax, investRebate, admissibleRebate, netTax, minTaxApplied, minimumTax, officePaidTax, finalPayable, salaryThird, annBasic, officeTaxBase, annPFEmployee, annPFOffice, taxOnBasic, maxRebatePossible, assumedNetTaxByOffice });
    updateMinTaxCard(minTaxApplied, areaType, grossTax, investRebate, minimumTax);
    updateTips({ taxableIncome, totalInvested, threePctIncome, investRebate, netTax, grossTax, officePaidTax, taxOnBasic, assumedNetTaxByOffice });

    // Update mobile floating summary card (if on mobile)
    if (typeof updateMobileSummary === 'function') updateMobileSummary({ finalPayable, grossTax, investRebate, officePaidTax, netTax });
}

// Mark PF field as manually overridden if user types in it
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const pfInput = document.getElementById('inv-provident-fund');
        if (pfInput) {
            pfInput.addEventListener('input', () => { pfInput._manualOverride = true; });
        }

        ['festival-bonus-amt', 'perf-bonus-amt', 'pf-employee-input', 'pf-office-input'].forEach(id => {
            const bonusInput = document.getElementById(id);
            if (bonusInput) {
                bonusInput.addEventListener('input', () => { bonusInput._manualOverride = true; });
            }
        });
    });
}

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

function updateInvestmentBar(totalInvested, admissibleRebate, threePctIncome) {
    document.getElementById('total-invested').textContent  = formatTaka(totalInvested);
    document.getElementById('admissible-invest').textContent = formatTaka(admissibleRebate);
    const pct = threePctIncome > 0 ? Math.min(100, Math.round((admissibleRebate / threePctIncome) * 100)) : 0;
    document.getElementById('invest-progress').style.width = pct + '%';
}

function updateResultHero({ netTax, finalPayable, monthlyOfficeTDS, grossTax, investRebate, effectiveRate, officePaidTax, taxOnBasic, officeMinTaxApplied }) {
    animateValue('final-payable-display', finalPayable);
    document.getElementById('net-tax-display').textContent    = formatTaka(netTax);
    
    const reason = officeMinTaxApplied ? '(Minimum Tax)' : (officePaidTax < taxOnBasic ? '(Capped by Assumed Net Tax)' : '(Tax on Basic + Employee PF)');
    document.getElementById('net-tax-monthly').innerHTML      = `Office Pays: <span style="color:var(--text-primary);font-weight:800">${formatTaka(officePaidTax)}</span> <span style="font-size:10px; opacity:0.7; font-weight:500;">${reason}</span>`;
    
    document.getElementById('gross-tax-display').textContent  = formatTaka(grossTax);
    document.getElementById('rebate-display').textContent     = formatTaka(investRebate);
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

function updateOpportunityDashboard({ threePctIncome, totalInvested, investRebate, grossIncome, taxableIncome, allowanceExemption }) {
    const container = document.getElementById('opp-dashboard-container');
    if (!container) return;

    const maxRebatePossible = Math.min(threePctIncome, getSetting('rebate-max-absolute', TAX_CONFIG.MAX_INVESTMENT_ABSOLUTE));
    const maxInvestmentAllowed = maxRebatePossible / (getSetting('rebate-rate-pct', TAX_CONFIG.REBATE_RATE * 100) / 100);
    
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
                    <strong>Action Required:</strong> You are missing out on tax savings! Invest an additional <strong style="color:var(--text-primary)">${formatTaka(remainingInvestment)}</strong> to claim your maximum rebate of <strong style="color:var(--text-primary)">${formatTaka(maxRebatePossible)}</strong>.
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
                    <div class="opp-title">Investment Capacity & Income Calculation</div>
                    <div class="opp-subtitle">Understanding your max investment limits</div>
                </div>
            </div>
            
            <div style="background:var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 12px; color:var(--text-secondary);">
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px;"><span>Total Gross Income:</span><strong style="color:var(--text-primary)">${formatTaka(grossIncome)}</strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px;"><span>Less: Exemption:</span><strong style="color:var(--accent-green)">-${formatTaka(allowanceExemption)}</strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px; border-bottom: 1px solid var(--border); padding-bottom: 4px;"><span>Taxable Income:</span><strong style="color:var(--text-primary)">${formatTaka(taxableIncome)}</strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px; margin-top: 4px;"><span>Max Rebate Cap (3% of Taxable Income):</span><strong style="color:var(--accent-amber)">${formatTaka(threePctIncome)}</strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px;"><span>Max Rebate Allowed (Capped at ৳7.5L):</span><strong style="color:var(--accent-amber)">${formatTaka(maxRebatePossible)}</strong></div>
                <div style="display:flex; justify-content:space-between; border-top: 1px solid var(--border); padding-top: 4px; font-weight: 700; color:var(--accent-green);"><span>Required Investment for Max Rebate (Rebate ÷ 10%):</span><span>${formatTaka(maxInvestmentAllowed)}</span></div>
            </div>

            <div class="opp-grid">
                <div class="opp-card">
                    <div class="opp-card-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Max Investment Target
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


function updateStepsVisual({ grossIncome, allowanceExemption, taxableIncome, taxFreeLimit, grossTax, investRebate, admissibleRebate, threePctIncome, totalInvested, netTax, officePaidTax, finalPayable, salaryThird, augMonths = 11, annBasic, officeTaxBase, annPFEmployee, annPFOffice, taxOnBasic, maxRebatePossible, assumedNetTaxByOffice }) {
    const container = document.getElementById('steps-visual');
    if (!container) return;

    const steps = [
        { n: 1, cls: 'step-c1', title: 'Annual Gross Income', detail: `Salary + Bonuses + Office PF + Other Income`, amount: grossIncome },
        { n: 2, cls: 'step-c2', title: '(−) Allowance Exemption', detail: `min(৳5,00,000 , 1/3 of Total Income ${formatTaka(salaryThird)}) = ${formatTaka(allowanceExemption)}`, amount: -allowanceExemption, isDeduction: true },
        { n: 3, cls: 'step-c3', title: '= Taxable Income', detail: 'Gross Income − Allowance Exemption', amount: taxableIncome, isResult: true },
        { n: 4, cls: 'step-c1', title: '(−) Tax-Free Threshold', detail: `Your category's tax-free limit`, amount: -taxFreeLimit, isDeduction: true },
        { n: 5, cls: 'step-c3', title: 'Gross Tax (from slabs)', detail: 'Progressive slab-wise calculation below', amount: grossTax },
        { n: 6, cls: 'step-c2', title: '(−) Investment Rebate', detail: `min(${getSetting('rebate-rate-pct', TAX_CONFIG.REBATE_RATE * 100)}% of investment, 3% of taxable income, ${formatTaka(getSetting('rebate-max-absolute', TAX_CONFIG.MAX_INVESTMENT_ABSOLUTE))}) | Total invested: ${formatTaka(totalInvested)}`, amount: -investRebate, isDeduction: true },
    ];

    steps.push({ n: steps.length + 1, cls: 'step-c3', title: '= Total Net Tax', detail: 'After all rebates & surcharges', amount: netTax, isResult: true });
    steps.push({ n: steps.length + 1, cls: 'step-c2', title: '(−) Tax Paid By Office', detail: `min(Tax on Basic + Employee PF ${formatTaka(taxOnBasic)}, Assumed Net Tax ${formatTaka(assumedNetTaxByOffice)}) | Base: Basic ${formatTaka(annBasic)} + Employee PF ${formatTaka(annPFEmployee)}`, amount: -officePaidTax, isDeduction: true });
    steps.push({ n: steps.length + 1, cls: 'step-c3', title: '= Final Payable By You', detail: 'Total Net Tax − Office Contribution', amount: finalPayable, isResult: true });

    container.innerHTML = steps.map((s, i) => `
        <div class="step-item">
            <div class="step-line-col">
                <div class="step-circle ${s.cls}">${s.n}</div>
                ${i < steps.length - 1 ? '<div class="step-connector"></div>' : ''}
            </div>
            <div class="step-body">
                <div class="step-title" style="${s.isFinal ? 'color:var(--accent-green);font-size:14px' : ''}">
                    ${s.title}
                    <span class="step-amount" style="color:${s.isDeduction ? 'var(--accent-green)' : s.isResult ? 'var(--accent-green)' : 'var(--text-primary)'}">${s.isDeduction ? '−' : ''}${formatTaka(Math.abs(s.amount))}</span>
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
        { name: '🛡️ Life Insurance',      amount: inv.lifeInsurance },
        { name: '🏦 Provident Fund (RPF)', amount: inv.providentFund },
        { name: '🏛️ GPF',                  amount: inv.gpf },
        { name: '🎯 Superannuation',       amount: inv.superannuation },
        { name: '🤝 Benevolent/Group Ins.',amount: inv.benevolent },
        { name: '📜 Sanchayapatra/Govt Sec',amount: inv.sanchaypatra },
        { name: '💰 DPS (max ৳1.2L)',     amount: inv.dps },
        { name: '📈 Listed Shares (DSE/CSE)',amount: inv.shares },
        { name: '📊 Mutual Funds',         amount: inv.mutual },
        { name: '🏅 Universal Pension',    amount: inv.pension },
        { name: '🏥 Charity Hospital',     amount: inv.charityHospital },
        { name: '♿ Disabled Welfare',     amount: inv.disability },
        { name: '🏳️ Liberation/Bangabandhu',amount: inv.liberation },
        { name: '🕌 Zakat Fund',           amount: inv.zakat },
    ].filter(c => c.amount > 0);
}

function updateInvestmentChart({ totalInvested, admissibleRebate, investRebate, threePctIncome, categories }) {
    const container = document.getElementById('inv-chart');
    if (!container) return;

    const maxInvestmentCap = threePctIncome / (getSetting('rebate-rate-pct', TAX_CONFIG.REBATE_RATE * 100) / 100);
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
            <div style="font-size:10px;color:var(--text-muted)">10% of investment, up to cap</div>
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


function updateComputationTable({ totalSalary, extraDaysSalary, festivalBonusAmt, perfBonusAmt, annGrossSalary, otherIncome, grossIncome, allowanceExemption, taxableIncome, taxFreeLimit, grossTax, investRebate, admissibleRebate, netTax, minTaxApplied, minimumTax, officePaidTax, finalPayable, salaryThird, annBasic, officeTaxBase, annPFEmployee, annPFOffice, taxOnBasic, maxRebatePossible, assumedNetTaxByOffice }) {
    const container = document.getElementById('computation-table');
    if (!container) return;
    container.innerHTML = '';

    const rows = [
        { label: 'A. INCOME COMPUTATION', isHeader: true },
        { label: 'Total Base Salary (Annual)', value: totalSalary - extraDaysSalary },
        { label: 'Extra Days Salary', value: extraDaysSalary, indent: true },
        { label: 'Festival Bonuses', value: festivalBonusAmt, indent: true },
        { label: 'Performance Bonuses', value: perfBonusAmt, indent: true },
        { label: 'Total Salary Income', value: annGrossSalary, isSubtotal: true },
        { label: 'Employer PF Contribution', value: annPFOffice, indent: true },
        { label: 'Other Income', value: otherIncome },
        { label: 'TOTAL GROSS INCOME', value: grossIncome, isSubtotal: true },
        { label: `Less: Allowance Exemption (min of ৳5,00,000 / 1/3 Total Income ${formatTaka(salaryThird)})`, value: -allowanceExemption, isDeduction: true },
        { label: 'TAXABLE INCOME', value: taxableIncome, isTotal: true },
        { label: 'Less: Tax-Free Threshold', value: -taxFreeLimit, isDeduction: true },
        { label: '', isDivider: true },
        { label: 'B. TAX CALCULATION', isHeader: true },
        { label: 'Gross Tax (Slab-wise)', value: grossTax },
        { label: `Less: Investment Rebate (min of ${getSetting('rebate-rate-pct', TAX_CONFIG.REBATE_RATE * 100)}% of invest or 3% of income)`, value: -investRebate, isDeduction: true },
        { label: 'Tax After Investment Rebate', value: Math.max(0, grossTax - investRebate), isSubtotal: true },
        minTaxApplied ? { label: `⚠ Minimum Tax Applied (${formatTaka(minimumTax)})`, value: minimumTax, note: true } : null,
        { label: 'Net Tax Payable', value: netTax, isSubtotal: true },
        { label: '', isDivider: true },
        { label: 'C. OFFICE CONTRIBUTION (TAX ON BASIC + EMPLOYEE PF)', isHeader: true },
        { label: 'Annual Basic Salary (60% of Salary)', value: annBasic },
        { label: 'Add: Employee PF Contribution', value: annPFEmployee, indent: true },
        { label: 'Office Taxable Base (Basic + Employee PF)', value: officeTaxBase, isSubtotal: true },
        { label: 'Computed Tax on Basic + Employee PF', value: taxOnBasic },
        { label: 'Office Assumed Net Tax (Gross Tax − Max Rebate)', value: assumedNetTaxByOffice, note: true },
        { label: `Less: Tax Paid by Office (min of Tax on Basic + Employee PF or Assumed Net Tax)`, value: -officePaidTax, isDeduction: true },
        { label: '', isDivider: true },
        { label: 'FINAL TAX PAYABLE BY YOU', value: finalPayable, isTotal: true }
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

function updateTips({ taxableIncome, totalInvested, threePctIncome, investRebate, netTax, grossTax, officePaidTax, taxOnBasic, assumedNetTaxByOffice }) {
    const list = document.getElementById('tips-list');
    list.innerHTML = '';
    const tips = [];

    if (totalInvested === 0 && taxableIncome > TAX_CONFIG.TAX_FREE_LIMITS.general) {
        tips.push('💡 No investments yet! With your income, you can potentially save tax. Start with PF, DPS (max ৳1,20,000/year), or Sanchayapatra.');
    }

    const maxRebatePossible = Math.min(threePctIncome, getSetting('rebate-max-absolute', TAX_CONFIG.MAX_INVESTMENT_ABSOLUTE));
    if (threePctIncome > 0 && investRebate < maxRebatePossible) {
        const unusedRebate = maxRebatePossible - investRebate;
        tips.push(`📊 You can earn up to ${formatTaka(unusedRebate)} more in investment rebate. Your 3%-of-income cap is ${formatTaka(threePctIncome)} (max ${formatTaka(getSetting('rebate-max-absolute', TAX_CONFIG.MAX_INVESTMENT_ABSOLUTE))}).`);
    }

    if (investRebate > 0) tips.push(`✅ Investment rebate saves you ${formatTaka(investRebate)} tax — that's 10% of your investments (subject to 3% income limit).`);

    if (taxOnBasic > 0 && officePaidTax < taxOnBasic) {
        tips.push(`🏢 Your Office Tax is capped at ${formatTaka(officePaidTax)}! Your employer assumes you will maximize your investment rebate. Since your expected tax after maximum rebate is ${formatTaka(assumedNetTaxByOffice)}, the office won't pay more than that even if the tax on your basic salary + employee PF is higher (${formatTaka(taxOnBasic)}).`);
    } else if (taxOnBasic > 0) {
        tips.push(`🏢 Your Office fully pays your Tax on Basic + Employee PF (${formatTaka(taxOnBasic)}).`);
    }

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
// PRINT  (overlay + window.print — works on all devices)
// ════════════════════════════════════════════════
function printReport() {
    const now = new Date().toLocaleDateString('en-BD', { day:'numeric', month:'long', year:'numeric' });
    
    // Fetch values
    const gross     = document.getElementById('strip-gross').textContent;
    const taxable   = document.getElementById('strip-taxable').textContent;
    const totalNet  = document.getElementById('net-tax-display').textContent;
    const rebate    = document.getElementById('rebate-display').textContent;
    const officePay = document.getElementById('net-tax-monthly').textContent; 
    const netTax    = document.getElementById('final-payable-display').textContent;
    const totalInvested = document.getElementById('total-invested').textContent;
    
    // Taxpayer details
    const taxpayerTypeSel = document.getElementById('taxpayer-type');
    const taxpayerTypeStr = taxpayerTypeSel.options[taxpayerTypeSel.selectedIndex].text;
    
    const areaSel = document.getElementById('area-type');
    const areaStr = areaSel.options[areaSel.selectedIndex].text;
    
    const compHTML  = document.getElementById('computation-table').innerHTML;
    let slabHTML  = document.getElementById('slab-table').innerHTML;
    
    // Add office slab table if it is currently visible
    const officeSlabContainer = document.getElementById('office-slab-container');
    if (officeSlabContainer && officeSlabContainer.style.display !== 'none') {
        const officeSlab = document.getElementById('office-slab-table').innerHTML;
        slabHTML += `<div style="margin-top: 16px;">${officeSlab}</div>`;
    }

    const overlay = document.getElementById('print-overlay');
    if (!overlay) { window.print(); return; }

    overlay.innerHTML = `
        <div class="pr-hdr" style="border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
            <div style="flex: 1;">
                <h1 style="margin: 0; font-size: 24px; color: #111; letter-spacing: -0.5px;">Income Tax Computation Report</h1>
                <p style="margin: 4px 0 0; font-size: 13px; color: #555; font-weight: 500;">FinSource Tax Calculator — NBR Bangladesh</p>
            </div>
            <div style="text-align: right; font-size: 12px; color: #555; line-height: 1.6;">
                <div>Date: <strong style="color:#111">${now}</strong></div>
                <div>Income Year: <strong style="color:#111">2024-2025</strong></div>
                <div>Assessment Year: <strong style="color:#111">2025-2026</strong></div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div style="border: 1px solid #ccc; border-radius: 6px; padding: 14px;">
                <h3 style="margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; border-bottom: 1px solid #eee; padding-bottom: 6px;">Taxpayer Details</h3>
                <div style="font-size: 12px; line-height: 2;">
                    <div style="display:flex; justify-content:space-between;"><strong>Name:</strong> <span>___________________________</span></div>
                    <div style="display:flex; justify-content:space-between;"><strong>TIN / NID:</strong> <span>___________________________</span></div>
                    <div style="display:flex; justify-content:space-between;"><strong>Category:</strong> <span>${taxpayerTypeStr.split('—')[0].trim()}</span></div>
                    <div style="display:flex; justify-content:space-between;"><strong>Location:</strong> <span>${areaStr.split('—')[0].trim()}</span></div>
                </div>
            </div>
            <div style="border: 1px solid #ccc; border-radius: 6px; padding: 14px; background: #f8fafc;">
                <h3 style="margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; border-bottom: 1px solid #eee; padding-bottom: 6px;">Summary at a Glance</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; line-height: 1.8;">
                    <div>Gross Income:</div><div style="text-align: right; font-weight: bold;">${gross}</div>
                    <div>Taxable Income:</div><div style="text-align: right; font-weight: bold;">${taxable}</div>
                    <div>Total Invested:</div><div style="text-align: right; font-weight: bold;">${totalInvested}</div>
                    <div style="color: #059669;">Tax Rebate:</div><div style="text-align: right; font-weight: bold; color: #059669;">${rebate}</div>
                </div>
            </div>
        </div>

        <div style="border: 2px solid #111; border-radius: 8px; padding: 16px; margin-bottom: 24px; background: #fff; text-align: center; box-shadow: 0 2px 0 #111;">
            <div style="font-size: 12px; color: #555; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; letter-spacing: 1px;">Final Tax Payable By You</div>
            <div style="font-size: 32px; font-weight: 800; color: #111; margin-bottom: 8px;">${netTax}</div>
            <div style="font-size: 12px; color: #555;">Total Tax: <strong>${totalNet}</strong> &nbsp;|&nbsp; <strong>${officePay}</strong></div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
            <div>
                <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #ccc; padding-bottom: 6px; margin-bottom: 12px; color: #333;">1. Detailed Computation</h2>
                <div style="border: 1px solid #eee; border-radius: 4px; padding: 4px;">
                    ${compHTML}
                </div>
            </div>
            
            <div style="page-break-inside: avoid;">
                <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #ccc; padding-bottom: 6px; margin-bottom: 12px; margin-top: 20px; color: #333;">2. Tax Slab Breakdown</h2>
                <div style="border: 1px solid #eee; border-radius: 4px; padding: 4px;">
                    ${slabHTML}
                </div>
            </div>
        </div>

        <div class="pr-footer" style="margin-top: 50px; padding-top: 20px; text-align: center; font-size: 11px; color: #777;">
            <div style="margin-top: 40px; display: flex; justify-content: space-between; padding: 0 40px; margin-bottom: 30px;">
                <div style="border-top: 1px solid #333; padding-top: 5px; width: 200px; text-align: center;">Date</div>
                <div style="border-top: 1px solid #333; padding-top: 5px; width: 200px; text-align: center;">Signature of Taxpayer</div>
            </div>
            <p>I hereby declare that the information provided above is true to the best of my knowledge.</p>
            <p style="margin-top: 8px; font-size: 10px;">Generated by FinSource Tax Calculator | Official e-Return portal: etaxnbr.gov.bd</p>
        </div>
    `;

    overlay.style.display = 'block';

    function cleanup() {
        overlay.style.display = 'none';
        overlay.innerHTML = '';
        window.removeEventListener('afterprint', cleanup);
    }
    window.addEventListener('afterprint', cleanup);
    window.print();
}


// ════════════════════════════════════════════════
// RESET
// ════════════════════════════════════════════════
function resetForm() {
    document.querySelectorAll('input[type="number"]').forEach(el => { el.value = ''; el._manualOverride = false; });
    document.getElementById('taxpayer-type').value = 'general';
    document.getElementById('area-type').value     = 'dhaka_ctg';
    const extraDaysEl = document.getElementById('extra-days-count');
    if (extraDaysEl) extraDaysEl.value = '16';
    const augMonthsEl = document.getElementById('aug-months');
    if (augMonthsEl) augMonthsEl.value = '11';
    const festCountEl = document.getElementById('festival-bonus-count');
    if (festCountEl) festCountEl.value = '2';
    const perfCountEl = document.getElementById('perf-bonus-count');
    if (perfCountEl) perfCountEl.value = '2';
    const rebateRateEl = document.getElementById('rebate-rate-pct');
    if (rebateRateEl) rebateRateEl.value = String(TAX_CONFIG.REBATE_RATE * 100);
    const rebateMaxEl = document.getElementById('rebate-max-absolute');
    if (rebateMaxEl) rebateMaxEl.value = String(TAX_CONFIG.MAX_INVESTMENT_ABSOLUTE);
    const dpsLimitEl = document.getElementById('dps-annual-limit');
    if (dpsLimitEl) dpsLimitEl.value = String(TAX_CONFIG.DPS_ANNUAL_LIMIT);
    const sanchayLimitEl = document.getElementById('sanchaypatra-annual-limit');
    if (sanchayLimitEl) sanchayLimitEl.value = String(TAX_CONFIG.SANCHAYPATRA_ANNUAL_LIMIT);
    document.getElementById('disabled-child').checked = false;
    document.getElementById('child-count-row').style.display = 'none';
    document.getElementById('festival-bonus-amt').value = '';
    document.getElementById('perf-bonus-amt').value = '';
    animTarget = 0;
    calculate();
}

// Node/CommonJS export so the pure core can be unit-tested without a browser.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TAX_CONFIG, computeTax, computeSlabs, formatTaka };
}
