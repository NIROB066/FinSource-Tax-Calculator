import tkinter as tk
from tkinter import ttk, messagebox
import csv
import math
import os

def load_config():
    config = {}
    dir_path = os.path.dirname(os.path.realpath(__file__))
    filepath = os.path.join(dir_path, "data.csv")
    
    if not os.path.exists(filepath):
        messagebox.showerror("Error", f"Configuration file data.csv not found at {filepath}")
        return {}

    try:
        with open(filepath, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                key = row.get('Key', '').strip()
                val = row.get('Value', '').strip()
                if not key:
                    continue
                try:
                    config[key] = float(val) if '.' in val else int(val)
                except ValueError:
                    config[key] = val
    except Exception as e:
        messagebox.showerror("Error", f"Failed to load data.csv: {str(e)}")
    
    return config

C = load_config()

def format_taka(amount):
    if math.isnan(amount) or amount == 0:
        return "৳0"
    abs_amt = abs(int(round(amount)))
    s = str(abs_amt)
    if len(s) <= 3:
        fmt = s
    else:
        fmt = s[-3:]
        rem = s[:-3]
        while len(rem) > 2:
            fmt = rem[-2:] + ',' + fmt
            rem = rem[:-2]
        if rem:
            fmt = rem + ',' + fmt
    return f"{'-' if amount < 0 else ''}৳{fmt}"

class TaxApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("FinSource Tax Calculator FY 2025-26")
        self.geometry("1100x800")
        
        self.style = ttk.Style(self)
        # Removed hardcoded colors so it adapts to macOS Light/Dark mode
        
        self.vars = {}
        self.build_ui()
        self.calculate()

    def add_var(self, name, default=0):
        v = tk.DoubleVar(value=default)
        v.trace_add("write", lambda *a: self.calculate())
        self.vars[name] = v
        return v

    def add_str_var(self, name, default=""):
        v = tk.StringVar(value=default)
        v.trace_add("write", lambda *a: self.calculate())
        self.vars[name] = v
        return v
        
    def add_int_var(self, name, default=0):
        v = tk.IntVar(value=default)
        v.trace_add("write", lambda *a: self.calculate())
        self.vars[name] = v
        return v
        
    def add_bool_var(self, name, default=False):
        v = tk.BooleanVar(value=default)
        v.trace_add("write", lambda *a: self.calculate())
        self.vars[name] = v
        return v

    def build_ui(self):
        main_frame = ttk.Frame(self, padding="20 20 20 20")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Left Panel (Notebook for tabs)
        left_frame = ttk.Frame(main_frame)
        left_frame.pack(side=tk.LEFT, fill=tk.Y, expand=False, padx=(0, 20))
        
        notebook = ttk.Notebook(left_frame)
        notebook.pack(fill=tk.BOTH, expand=True)
        
        # Tab 1: Income & Details
        tab_income = ttk.Frame(notebook, padding="10")
        notebook.add(tab_income, text="Details & Income")
        
        # Tab 2: Investments
        tab_invest = ttk.Frame(notebook, padding="10")
        notebook.add(tab_invest, text="Investments (14 Categories)")
        
        # --- TAB 1 CONTENT ---
        ttk.Label(tab_income, text="1. Basic Information", font=('Helvetica', 12, 'bold')).pack(anchor=tk.W, pady=(0,10))
        
        grid_info = ttk.Frame(tab_income)
        grid_info.pack(fill=tk.X, pady=(0, 15))
        
        ttk.Label(grid_info, text="Taxpayer Category:").grid(row=0, column=0, sticky=tk.W, pady=2)
        self.type_cb = ttk.Combobox(grid_info, textvariable=self.add_str_var("taxpayer_type", "general"), state="readonly")
        self.type_cb['values'] = ('general', 'women_senior', 'disabled', 'third_gender', 'freedom_fighter')
        self.type_cb.grid(row=0, column=1, sticky=tk.EW, pady=2, padx=5)
        
        ttk.Label(grid_info, text="City Area:").grid(row=1, column=0, sticky=tk.W, pady=2)
        self.area_cb = ttk.Combobox(grid_info, textvariable=self.add_str_var("area_type", "dhaka_ctg"), state="readonly")
        self.area_cb['values'] = ('dhaka_ctg', 'other_city', 'outside_city')
        self.area_cb.grid(row=1, column=1, sticky=tk.EW, pady=2, padx=5)
        
        ttk.Label(grid_info, text="Filing Quarter:").grid(row=2, column=0, sticky=tk.W, pady=2)
        self.qtr_cb = ttk.Combobox(grid_info, textvariable=self.add_str_var("filing_quarter", "q2"), state="readonly")
        self.qtr_cb['values'] = ('q1', 'q2', 'q3', 'q4')
        self.qtr_cb.grid(row=2, column=1, sticky=tk.EW, pady=2, padx=5)
        
        ttk.Checkbutton(grid_info, text="Have Disabled Child?", variable=self.add_bool_var("has_disabled_child")).grid(row=3, column=0, columnspan=2, sticky=tk.W, pady=2)
        ttk.Label(grid_info, text="Disabled Child Count:").grid(row=4, column=0, sticky=tk.W, pady=2)
        ttk.Entry(grid_info, textvariable=self.add_int_var("disabled_child_count", 1), width=5).grid(row=4, column=1, sticky=tk.W, pady=2, padx=5)
        
        ttk.Label(tab_income, text="2. Income Details", font=('Helvetica', 12, 'bold')).pack(anchor=tk.W, pady=(10,10))
        grid_inc = ttk.Frame(tab_income)
        grid_inc.pack(fill=tk.X, pady=(0, 15))
        
        self.create_input(grid_inc, "July Gross Salary", "july_gross", 0, 0)
        self.create_input(grid_inc, "August-June Gross", "aug_gross", 1, 0)
        self.create_input(grid_inc, "Other Income", "other_income", 2, 0)
        
        # --- TAB 2 CONTENT (14 INVESTMENTS) ---
        canvas = tk.Canvas(tab_invest, highlightthickness=0)
        scrollbar = ttk.Scrollbar(tab_invest, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        ttk.Label(scrollable_frame, text="NBR Approved Investments", font=('Helvetica', 12, 'bold')).pack(anchor=tk.W, pady=(0,10))
        grid_inv = ttk.Frame(scrollable_frame)
        grid_inv.pack(fill=tk.X)
        
        self.create_input(grid_inv, "DPS (Max 1.2L)", "inv_dps", 0, 0)
        self.create_input(grid_inv, "Savings Certificate", "inv_sanchaypatra", 1, 0)
        self.create_input(grid_inv, "Listed Shares", "inv_shares", 2, 0)
        self.create_input(grid_inv, "Mutual Funds", "inv_mutual", 3, 0)
        self.create_input(grid_inv, "Life Insurance", "inv_life", 4, 0)
        self.create_input(grid_inv, "Universal Pension", "inv_pension", 5, 0)
        self.create_input(grid_inv, "Zakat Fund", "inv_zakat", 6, 0)
        self.create_input(grid_inv, "Benevolent Fund", "inv_benevolent", 7, 0)
        self.create_input(grid_inv, "Group Insurance", "inv_group_ins", 8, 0)
        self.create_input(grid_inv, "Aga Khan Dev Network", "inv_agakhan", 9, 0)
        self.create_input(grid_inv, "Philanthropic Inst.", "inv_philanthropic", 10, 0)
        self.create_input(grid_inv, "Nat. Level Inst.", "inv_national", 11, 0)
        self.create_input(grid_inv, "Liberation War Museum", "inv_liberation", 12, 0)
        self.create_input(grid_inv, "Ahsania Mission Cancer", "inv_ahsania", 13, 0)
        
        # --- RIGHT FRAME: RESULTS ---
        right_frame = ttk.Frame(main_frame)
        right_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        ttk.Label(right_frame, text="Tax Summary", font=('Helvetica', 14, 'bold')).pack(anchor=tk.W, pady=(0,10))
        
        self.res_card = ttk.Frame(right_frame, relief=tk.SOLID, borderwidth=1)
        self.res_card.pack(fill=tk.X, pady=(0,20))
        
        self.lbl_final_tax = ttk.Label(self.res_card, text="Final Tax Payable By You: ৳0", font=('Helvetica', 16, 'bold'))
        self.lbl_final_tax.pack(pady=(10, 5))
        
        self.lbl_office_tax = ttk.Label(self.res_card, text="Office Pays: ৳0 (Tax on Basic)", font=('Helvetica', 12))
        self.lbl_office_tax.pack(pady=(0, 10))
        
        # Details text
        self.details_txt = tk.Text(right_frame, font=('Consolas', 11), state=tk.DISABLED, wrap=tk.WORD)
        self.details_txt.pack(fill=tk.BOTH, expand=True)

    def create_input(self, parent, label, var_name, row, col):
        ttk.Label(parent, text=label).grid(row=row, column=col*2, sticky=tk.W, pady=4)
        ttk.Entry(parent, textvariable=self.add_var(var_name), width=15).grid(row=row, column=col*2+1, sticky=tk.W, pady=4, padx=5)

    def calculate(self, *args):
        try:
            # Inputs
            july_gross = self.vars['july_gross'].get()
            aug_gross = self.vars['aug_gross'].get()
            other_inc = self.vars['other_income'].get()
            
            # FinSource Salary Logic
            total_salary = july_gross + (aug_gross * 11)
            
            fest_bonus = (aug_gross * C.get('FESTIVAL_BONUS_PCT', 0.60)) * C.get('FESTIVAL_BONUS_COUNT', 2)
            perf_bonus = (aug_gross * C.get('PERF_BONUS_PCT', 0.20)) * C.get('PERF_BONUS_COUNT', 2)
            
            ann_gross_salary = total_salary + fest_bonus + perf_bonus
            gross_income = ann_gross_salary + other_inc
            
            ann_basic = (july_gross * C.get('SALARY_BASIC_PCT', 0.60)) + (aug_gross * C.get('SALARY_BASIC_PCT', 0.60) * 11)
            
            pf_emp = ann_basic * C.get('PF_EMPLOYEE_PCT', 0.06)
            
            # Exemptions
            salary_third = ann_gross_salary * (1/3)
            max_exemp = C.get('MAX_ALLOWANCE_EXEMPTION', 450000)
            exemption = min(max_exemp, salary_third)
            
            taxable_inc = max(0, gross_income - exemption)
            
            # Tax Free Limit
            t_type = self.vars['taxpayer_type'].get()
            tf_key = {
                'general': 'TAX_FREE_GENERAL',
                'women_senior': 'TAX_FREE_WOMEN_SENIOR',
                'disabled': 'TAX_FREE_DISABLED',
                'third_gender': 'TAX_FREE_THIRD_GENDER',
                'freedom_fighter': 'TAX_FREE_FREEDOM_FIGHTER'
            }.get(t_type, 'TAX_FREE_GENERAL')
            tax_free = C.get(tf_key, 375000)
            
            if self.vars['has_disabled_child'].get():
                tax_free += C.get('DISABLED_CHILD_EXTRA', 50000) * self.vars['disabled_child_count'].get()
            
            # Compute Slabs
            def calc_tax(amount):
                rem = max(0, amount - tax_free)
                tax = 0
                slabs = [
                    (C.get('TAX_SLAB_1_LIMIT', 300000), C.get('TAX_SLAB_1_RATE', 0.10)),
                    (C.get('TAX_SLAB_2_LIMIT', 400000), C.get('TAX_SLAB_2_RATE', 0.15)),
                    (C.get('TAX_SLAB_3_LIMIT', 500000), C.get('TAX_SLAB_3_RATE', 0.20)),
                    (C.get('TAX_SLAB_4_LIMIT', 2000000), C.get('TAX_SLAB_4_RATE', 0.25)),
                    (float('inf'), C.get('TAX_SLAB_5_RATE', 0.30))
                ]
                for limit, rate in slabs:
                    if rem <= 0: break
                    app = min(rem, limit)
                    tax += app * rate
                    rem -= app
                return tax

            office_tax = calc_tax(ann_basic)
            gross_tax = calc_tax(taxable_inc)
            
            # Investments (14 categories)
            total_inv = (
                self.vars['inv_dps'].get() +
                self.vars['inv_sanchaypatra'].get() +
                self.vars['inv_shares'].get() +
                self.vars['inv_mutual'].get() +
                self.vars['inv_life'].get() +
                self.vars['inv_pension'].get() +
                self.vars['inv_zakat'].get() +
                self.vars['inv_benevolent'].get() +
                self.vars['inv_group_ins'].get() +
                self.vars['inv_agakhan'].get() +
                self.vars['inv_philanthropic'].get() +
                self.vars['inv_national'].get() +
                self.vars['inv_liberation'].get() +
                self.vars['inv_ahsania'].get() +
                pf_emp
            )
            
            admissible_rebate = min(
                total_inv * C.get('REBATE_RATE', 0.10),
                taxable_inc * C.get('MAX_INV_INCOME_PCT', 0.03),
                C.get('MAX_INV_ABSOLUTE', 750000)
            )
            
            net_tax = max(0, gross_tax - admissible_rebate)
            
            # Min tax check
            area = self.vars['area_type'].get()
            min_tax = 0
            if taxable_inc > tax_free:
                if area == 'dhaka_ctg': min_tax = C.get('MIN_TAX_DHAKA_CTG', 5000)
                elif area == 'other_city': min_tax = C.get('MIN_TAX_OTHER_CITY', 4000)
                else: min_tax = C.get('MIN_TAX_OUTSIDE', 3000)
                
            net_tax = max(net_tax, min_tax) if taxable_inc > tax_free else 0
            
            # Early filing rebate check (5% of net tax or 5000)
            early_rebate = 0
            qtr = self.vars['filing_quarter'].get()
            if qtr == 'q1':
                early_rebate = min(net_tax * 0.05, 5000)
            
            net_tax = max(0, net_tax - early_rebate)
            
            # Final calculation
            final_payable = max(0, net_tax - office_tax)
            
            # UI Update
            self.lbl_final_tax.config(text=f"Final Tax Payable By You: {format_taka(final_payable)}")
            self.lbl_office_tax.config(text=f"Office Pays: {format_taka(office_tax)} (Tax on Basic)")
            
            details = f"""--- INCOME COMPUTATION ---
Total Base Salary:      {format_taka(total_salary)}
Festival Bonuses:       {format_taka(fest_bonus)}
Performance Bonuses:    {format_taka(perf_bonus)}
Other Income:           {format_taka(other_inc)}
----------------------------------
GROSS INCOME:           {format_taka(gross_income)}
(-) Exemption:          {format_taka(exemption)}
TAXABLE INCOME:         {format_taka(taxable_inc)}

--- TAX COMPUTATION ---
Tax-Free Limit:         {format_taka(tax_free)}
Gross Tax:              {format_taka(gross_tax)}
(-) Investment Rebate:  {format_taka(admissible_rebate)}
----------------------------------
TOTAL BEFORE TIMELY:    {format_taka(gross_tax - admissible_rebate)}
(-) Early Filing Rebate:{format_taka(early_rebate)}  *(5% cap 5k if Q1)*
----------------------------------
TOTAL NET TAX:          {format_taka(net_tax)}
(-) Office Paid Tax:    {format_taka(office_tax)}
----------------------------------
FINAL PAYABLE BY YOU:   {format_taka(final_payable)}

--- REBATE SUMMARY ---
Your PF Contribution:   {format_taka(pf_emp)}  (Auto-added)
Total Invested:         {format_taka(total_inv)}
Investment Capacity:    {format_taka(taxable_inc * C.get('MAX_INV_INCOME_PCT', 0.03))}
"""
            self.details_txt.config(state=tk.NORMAL)
            self.details_txt.delete("1.0", tk.END)
            self.details_txt.insert(tk.END, details)
            self.details_txt.config(state=tk.DISABLED)

        except Exception as e:
            pass # Ignore calculation errors during active typing

if __name__ == "__main__":
    app = TaxApp()
    app.mainloop()
