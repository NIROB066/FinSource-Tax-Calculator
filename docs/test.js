/**
 * FinSource Tax Calculator — regression test suite
 * ------------------------------------------------
 * Run with:  node "Tax Calculator/test.js"
 *
 * These tests exercise the pure core (`computeTax` / `computeSlabs`) exported from
 * calculator.js, so any future rule change can be verified without a browser.
 */

const { TAX_CONFIG, computeTax, computeSlabs } = require('./calculator.js');

let passed = 0;
let failed = 0;

function eq(actual, expected, label) {
    if (actual === expected) {
        passed++;
        console.log(`  PASS  ${label} = ${actual}`);
    } else {
        failed++;
        console.log(`  FAIL  ${label}: expected ${expected}, got ${actual}`);
    }
}

function section(title) {
    console.log(`\n${title}\n${'-'.repeat(title.length)}`);
}

// ════════════════════════════════════════════════
// 1. Slab structure
//    First 4,00,000 -> None | Next 3,00,000 -> 10% | Next 4,00,000 -> 15%
//    Next 5,00,000 -> 20%   | Next 20,00,000 -> 25% | Onward -> 30%
// ════════════════════════════════════════════════
section('1. Slab configuration');
eq(TAX_CONFIG.TAX_FREE_LIMITS.general, 400000, 'tax-free limit (general)');
const expectedSlabs = [
    [300000, 0.10],
    [400000, 0.15],
    [500000, 0.20],
    [2000000, 0.25],
    [Infinity, 0.30],
];
expectedSlabs.forEach(([limit, rate], i) => {
    eq(TAX_CONFIG.TAX_SLABS[i].limit, limit, `slab ${i + 1} limit`);
    eq(TAX_CONFIG.TAX_SLABS[i].rate, rate, `slab ${i + 1} rate`);
});

// ════════════════════════════════════════════════
// 2. Slab boundaries (tax-free limit 4,00,000)
// ════════════════════════════════════════════════
section('2. Slab boundary maths');
const slabCases = [
    [400000, 0],            // exactly at the threshold
    [500000, 10000],        // 1,00,000 @ 10%
    [700000, 30000],        // 3,00,000 @ 10%
    [1100000, 90000],       // + 4,00,000 @ 15%
    [1600000, 190000],      // + 5,00,000 @ 20%
    [3600000, 690000],      // + 20,00,000 @ 25%
    [4600000, 990000],      // + 10,00,000 @ 30%
];
slabCases.forEach(([income, tax]) => {
    eq(computeSlabs(income, 400000).totalTax, tax, `tax on taxable income ${income}`);
});

// ════════════════════════════════════════════════
// 3. Investment caps (DPS 1.2L, Sanchayapatra 5L)
// ════════════════════════════════════════════════
section('3. Investment caps');
eq(TAX_CONFIG.DPS_ANNUAL_LIMIT, 120000, 'DPS annual limit');
eq(TAX_CONFIG.SANCHAYPATRA_ANNUAL_LIMIT, 500000, 'Sanchayapatra annual limit');

const capped = computeTax({
    julyGross: 100000, augGross: 118000, augMonths: 11,
    investments: { providentFund: 0, dps: 300000, sanchaypatra: 900000 },
});
eq(capped.investments.dps, 120000, 'DPS above limit is capped');
eq(capped.investments.sanchaypatra, 500000, 'Sanchayapatra above limit is capped');
eq(capped.totalInvested, 620000, 'total invested uses capped amounts');

const underCap = computeTax({
    julyGross: 100000, augGross: 118000, augMonths: 11,
    investments: { providentFund: 0, dps: 90000, sanchaypatra: 250000 },
});
eq(underCap.investments.dps, 90000, 'DPS below limit is untouched');
eq(underCap.investments.sanchaypatra, 250000, 'Sanchayapatra below limit is untouched');

// ════════════════════════════════════════════════
// 4. Scenario A — July ৳1,00,000 + 11 months ৳1,18,000 (salary only)
//    No extra days, no bonuses, no other income, PF auto-calculated.
// ════════════════════════════════════════════════
section('4. Scenario A — salary only (July 1,00,000 + 11 x 1,18,000)');
const a = computeTax({
    taxpayerType: 'general',
    areaType: 'dhaka_ctg',
    julyGross: 100000,
    augGross: 118000,
    augMonths: 11,
    extraDaysCount: 0,
    festivalBonusCount: 0,
    perfBonusCount: 0,
    otherIncome: 0,
});
eq(a.totalSalary, 1398000, 'annual salary');
eq(a.annBasic, 838800, 'annual basic (60%)');
eq(a.annPFEmployee, 83880, 'employee PF (6% of basic)');
eq(a.annPFOffice, 83880, 'office PF (6% of basic)');
eq(a.grossIncome, 1481880, 'gross income (salary + office PF)');
eq(a.allowanceExemption, 493960, 'allowance exemption (1/3, capped at 5,00,000)');
eq(a.taxableIncome, 987920, 'taxable income');
eq(a.grossTax, 73188, 'gross tax from slabs');
eq(a.totalInvested, 167760, 'total investment (employee + office PF)');
eq(a.threePctIncome, 29638, 'max rebate cap (3% of taxable income)');
eq(a.investRebate, 16776, 'investment rebate (10% of investment)');
eq(a.netTax, 56412, 'TOTAL TAX (net tax after rebate)');
eq(a.officeTaxBase, 922680, 'office tax base (basic + employee PF)');
eq(a.taxOnBasic, 63402, 'tax computed on office base');
eq(a.assumedNetTaxByOffice, 43550, 'office assumed net tax (gross tax - max rebate)');
eq(a.officePaidTax, 43550, 'OFFICE PAYS');
eq(a.finalPayable, 12862, 'YOU PAY');

// ════════════════════════════════════════════════
// 5. Scenario B — same salary with the app's default extras
//    16 extra days, 2 festival bonuses, 2 performance bonuses.
// ════════════════════════════════════════════════
section('5. Scenario B — same salary + default extra days & bonuses');
const b = computeTax({
    taxpayerType: 'general',
    areaType: 'dhaka_ctg',
    julyGross: 100000,
    augGross: 118000,
    augMonths: 11,
    extraDaysCount: 16,
    festivalBonusCount: 2,
    perfBonusCount: 2,
    otherIncome: 0,
});
eq(b.extraDaysSalary, 61733, 'extra days salary (2 @ July rate + 14 @ Aug rate)');
eq(b.festivalBonusAmt, 141600, 'festival bonuses (2 x 60%)');
eq(b.perfBonusAmt, 43600, 'performance bonuses (20% each)');
eq(b.grossIncome, 1728813, 'gross income');
eq(b.allowanceExemption, 500000, 'allowance exemption (capped at 5,00,000)');
eq(b.taxableIncome, 1228813, 'taxable income');
eq(b.grossTax, 115763, 'gross tax from slabs');
eq(b.investRebate, 16776, 'investment rebate');
eq(b.netTax, 98987, 'TOTAL TAX (net tax after rebate)');
eq(b.taxOnBasic, 63402, 'tax computed on office base');
eq(b.assumedNetTaxByOffice, 78899, 'office assumed net tax');
eq(b.officePaidTax, 63402, 'OFFICE PAYS');
eq(b.finalPayable, 35585, 'YOU PAY');

// ════════════════════════════════════════════════
// 6. Minimum tax still applies when the rebate wipes out the tax
// ════════════════════════════════════════════════
section('6. Minimum tax floor');
const minCase = computeTax({
    areaType: 'dhaka_ctg',
    julyGross: 55000,
    augGross: 55000,
    augMonths: 11,
    extraDaysCount: 0,
    festivalBonusCount: 0,
    perfBonusCount: 0,
    investments: { providentFund: 0, sanchaypatra: 500000 },
});
eq(minCase.minTaxApplied, true, 'minimum tax applied');
eq(minCase.netTax, 5000, 'net tax floors at Dhaka/Ctg minimum');

// ════════════════════════════════════════════════
section('Summary');
console.log(`  ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
