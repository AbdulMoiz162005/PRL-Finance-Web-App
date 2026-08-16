-- ============================================================================
-- Refinery Terminal Finance System - Seed data (demo)
-- ============================================================================

insert into companies (id, name, legal_name, tax_id, address, phone, email, currency, fiscal_year_start, registration_no)
values (
  '00000000-0000-4000-8000-000000000001',
  'Meridian Refinery Terminal Ltd',
  'Meridian Refinery & Petrochemical Terminal Plc',
  'TX-7712045-9',
  'Km 12 Port Access Road, Terminal Zone B, Onne, Nigeria',
  '+234 901 234 5678',
  'finance@meridianrefinery.ng',
  'USD',
  '2026-01-01',
  'RC-88231'
);

-- ---------------------------------------------------------------------------
-- Chart of accounts
-- ---------------------------------------------------------------------------
insert into chart_of_accounts (id, company_id, code, name, type, subtype, cash_flow_category, is_postable, normal_balance, opening_balance) values
('00001001-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','1001','Petty Cash','asset','cash','operating',true,'debit',5000),
('00001100-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','1100','Bank - Corporate Current Account','asset','cash','operating',true,'debit',2500000),
('00001101-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','1101','Bank - Terminal Operations Account','asset','cash','operating',true,'debit',1200000),
('00001200-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','1200','Accounts Receivable - Trade','asset','current','operating',true,'debit',850000),
('00001300-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','1300','Inventory - Refined Products','asset','current','operating',true,'debit',4285000),
('00001410-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','1410','Land & Buildings','asset','fixed','investing',true,'debit',12000000),
('00001411-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','1411','Terminal Plant & Equipment','asset','fixed','investing',true,'debit',18500000),
('00001412-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','1412','Storage Tanks & Spheres','asset','fixed','investing',true,'debit',22000000),
('00001413-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','1413','Loading / Gantry Equipment','asset','fixed','investing',true,'debit',9300000),
('00001414-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','1414','Vehicles & Trucks','asset','fixed','investing',true,'debit',3200000),
('00001415-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','1415','Office Furniture & IT Equipment','asset','fixed','investing',true,'debit',850000),
('00001420-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','1420','Accumulated Depreciation','asset','contra','investing',true,'credit',14200000),
('00001500-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','1500','Prepayments','asset','current','operating',true,'debit',300000),
('00001600-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','1600','Other Receivables','asset','current','operating',true,'debit',120000),
('00002100-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','2100','Trade Payables - Suppliers','liability','current','operating',true,'credit',1450000),
('00002200-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','2200','Accrued Expenses','liability','current','operating',true,'credit',210000),
('00002300-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','2300','VAT / Sales Tax Payable','liability','current','operating',true,'credit',95000),
('00002310-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','2310','VAT Recoverable (Input)','asset','current','operating',true,'debit',0),
('00002400-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','2400','Withholding Tax Payable','liability','current','operating',true,'credit',38000),
('00002500-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','2500','Bank Loans - Long Term','liability','long_term','financing',true,'credit',5000000),
('00002600-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','2600','Other Payables','liability','current','operating',true,'credit',66000),
('00003000-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','3000','Share Capital','equity','equity','financing',true,'credit',30000000),
('00003100-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','3100','Retained Earnings','equity','retained_earnings','financing',false,'credit',24051000),
('00003200-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','3200','Dividends Declared','equity','equity','financing',true,'debit',0),
('00004000-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','4000','Sales Revenue - Fuels','revenue','operating_revenue','operating',true,'credit',0),
('00004100-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','4100','Sales Revenue - LPG','revenue','operating_revenue','operating',true,'credit',0),
('00004200-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','4200','Sales Revenue - Lubricants','revenue','operating_revenue','operating',true,'credit',0),
('00004300-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','4300','Throughput & Storage Fees','revenue','operating_revenue','operating',true,'credit',0),
('00004400-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','4400','Other Operating Revenue','revenue','operating_revenue','operating',true,'credit',0),
('00004450-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','4450','Interest Income','revenue','other_income','operating',true,'credit',0),
('00004460-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','4460','Other Non-Operating Income','revenue','other_income','operating',true,'credit',0),
('00004500-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','4500','Discounts Allowed','revenue','contra','operating',true,'debit',0),
('00005000-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','5000','Cost of Products Sold','expense','cost_of_sales','operating',true,'debit',0),
('00006010-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6010','Staff Salaries & Wages','expense','operating_expense','operating',true,'debit',0),
('00006020-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6020','Staff Benefits & Allowances','expense','operating_expense','operating',true,'debit',0),
('00006030-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6030','Utilities - Electricity & Water','expense','operating_expense','operating',true,'debit',0),
('00006040-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6040','Fuel & Power for Operations','expense','operating_expense','operating',true,'debit',0),
('00006050-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6050','Maintenance & Repairs','expense','operating_expense','operating',true,'debit',0),
('00006060-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6060','Insurance','expense','operating_expense','operating',true,'debit',0),
('00006070-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6070','Transport & Logistics','expense','operating_expense','operating',true,'debit',0),
('00006080-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6080','Security Services','expense','operating_expense','operating',true,'debit',0),
('00006090-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6090','Rent & Lease','expense','operating_expense','operating',true,'debit',0),
('00006100-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6100','Depreciation Expense','expense','operating_expense','operating',true,'debit',0),
('00006110-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6110','Bank Charges & Interest','expense','operating_expense','operating',true,'debit',0),
('00006120-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6120','Professional Fees','expense','operating_expense','operating',true,'debit',0),
('00006130-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6130','Licenses & Regulatory Fees','expense','operating_expense','operating',true,'debit',0),
('00006140-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6140','HSE & Training','expense','operating_expense','operating',true,'debit',0),
('00006150-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6150','Communication & IT','expense','operating_expense','operating',true,'debit',0),
('00006160-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6160','Stationery & Consumables','expense','operating_expense','operating',true,'debit',0),
('00006170-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6170','Marketing & Distribution','expense','operating_expense','operating',true,'debit',0),
('00006180-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6180','Miscellaneous Expense','expense','operating_expense','operating',true,'debit',0),
('00006190-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6190','Doubtful Debts Expense','expense','operating_expense','operating',true,'debit',0),
('00006600-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','6600','Income Tax Expense','expense','operating_expense','operating',true,'debit',0);

-- ---------------------------------------------------------------------------
-- Cost centers
-- ---------------------------------------------------------------------------
insert into cost_centers (id, company_id, code, name, description) values
('cc000001-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','CC-ADM','Administration','Corporate administration and finance'),
('cc000002-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','CC-OPS','Terminal Operations','Loading, gantry and product handling'),
('cc000003-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','CC-STOR','Storage & Tanks','Tank farm, spheres and pipelines'),
('cc000004-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','CC-LOG','Logistics & Distribution','Haulage and product dispatch'),
('cc000005-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','CC-HSE','HSE & Compliance','Health, safety, environment and licenses'),
('cc000006-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','CC-MKT','Marketing & Sales','Customer accounts and sales team');

-- ---------------------------------------------------------------------------
-- Tax codes & payment terms
-- ---------------------------------------------------------------------------
insert into tax_codes (id, company_id, code, name, rate) values
('af000000-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','TX-0','Exempt',0),
('af000005-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','TX-5','VAT 5%',5),
('af000010-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','TX-10','VAT 10%',10),
('af0000a5-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','TX-WHT','Withholding 5%',5);

insert into payment_terms (id, company_id, name, days) values
('aa000000-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','Due on Receipt',0),
('aa000030-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','Net 30',30),
('aa000045-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','Net 45',45),
('aa000060-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','Net 60',60);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
insert into customers (id, company_id, code, name, tax_id, contact_person, phone, email, address, credit_limit, payment_term_days, opening_balance, status) values
('10000001-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','C-1001','Meridian Oil & Gas Ltd','VAT-224110','Chuka Eze','+234 801 111 2233','ap@meridianoil.ng','12 Industrial Ave, Lagos',2000000,30,0,'active'),
('10000002-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','C-1002','Atlas Petroleum Marketing','VAT-224111','Bisi Adeyemi','+234 802 222 3344','billing@atlaspetro.com','Plot 7 Marina Road, Lagos',1500000,30,0,'active'),
('10000003-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','C-1003','Gulf Stream Trading Co','VAT-224112','Rashid Bello','+234 803 333 4455','acct@gulfstreamtrade.com','9 Depot Rd, Port Harcourt',1000000,45,0,'active'),
('10000004-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','C-1004','Zenith Logistics Ltd','VAT-224113','Tunde Bakare','+234 804 444 5566','finance@zenithlog.com','22 Cargo Way, Apapa',800000,30,0,'active'),
('10000005-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','C-1005','Harbor Bunkering Services','VAT-224114','Grace Okoro','+234 805 555 6677','payables@harborbunkering.com','Berth 4, Terminal Jetty',500000,15,0,'active');

-- ---------------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------------
insert into suppliers (id, company_id, code, name, tax_id, contact_person, phone, email, address, payment_term_days, opening_balance, status) values
('20000001-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','S-2001','Delta Crude & Products Supply','VAT-334001','Ibrahim Musa','+234 806 666 7788','sales@deltacrude.com','Refinery Row, Warri',30,0,'active'),
('20000002-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','S-2002','PetroSource International','VAT-334002','Lena Fischer','+49 30 555 1010','billing@petrosource.de','Uhlandstr 8, Hamburg',45,0,'active'),
('20000003-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','S-2003','TransTank Haulage Ltd','VAT-334003','Kola Alabi','+234 807 777 8899','ops@transtank.ng','3 Haulage Yard, Onne',30,0,'active'),
('20000004-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','S-2004','SafeGuard Security Services','VAT-334004','Ngozi Umeh','+234 808 888 9900','accounts@safeguard.ng','17 Barracks Road, Port Harcourt',30,0,'active'),
('20000005-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','S-2005','EnviroWaste Disposal Ltd','VAT-334005','Femi Alao','+234 809 999 0011','billing@envirowaste.ng','6 Eco Park, Rivers',30,0,'active');

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
insert into products (id, company_id, code, name, category, unit, tax_code_id, valuation_method, opening_qty, opening_unit_cost, sales_account_id, cogs_account_id, inventory_account_id, is_active) values
('50000001-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','P-1001','Premium Motor Spirit (PMS)','fuel','litres','af000005-0000-4000-8000-000000000000','avg',2000000,1.02,'00004000-0000-4000-8000-000000000000','00005000-0000-4000-8000-000000000000','00001300-0000-4000-8000-000000000000',true),
('50000002-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','P-1002','Automotive Gas Oil (AGO)','fuel','litres','af000005-0000-4000-8000-000000000000','avg',1500000,1.08,'00004000-0000-4000-8000-000000000000','00005000-0000-4000-8000-000000000000','00001300-0000-4000-8000-000000000000',true),
('50000003-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','P-1003','Dual Purpose Kerosene (DPK)','fuel','litres','af000005-0000-4000-8000-000000000000','avg',400000,1.00,'00004000-0000-4000-8000-000000000000','00005000-0000-4000-8000-000000000000','00001300-0000-4000-8000-000000000000',true),
('50000004-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','P-1004','Liquefied Petroleum Gas (LPG)','fuel','tonnes','af000005-0000-4000-8000-000000000000','avg',200,900.00,'00004100-0000-4000-8000-000000000000','00005000-0000-4000-8000-000000000000','00001300-0000-4000-8000-000000000000',true),
('50000005-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','P-1005','Lubricants - Engine Oil 20W-50','lubricant','litres','af000010-0000-4000-8000-000000000000','avg',10000,4.50,'00004200-0000-4000-8000-000000000000','00005000-0000-4000-8000-000000000000','00001300-0000-4000-8000-000000000000',true),
('50000006-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','P-1006','Terminal Storage Service','service','service','af000000-0000-4000-8000-000000000000','avg',0,0,'00004300-0000-4000-8000-000000000000','00005000-0000-4000-8000-000000000000','00001300-0000-4000-8000-000000000000',true),
('50000007-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','P-1007','Throughput / Loading Fee','service','service','af000000-0000-4000-8000-000000000000','avg',0,0,'00004300-0000-4000-8000-000000000000','00005000-0000-4000-8000-000000000000','00001300-0000-4000-8000-000000000000',true);

-- ---------------------------------------------------------------------------
-- Storage tanks
-- ---------------------------------------------------------------------------
insert into storages (id, company_id, code, name, kind, capacity, product_id, is_active) values
('60000001-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','ST-TK01','Tank 1 - PMS','tank',250000,'50000001-0000-4000-8000-000000000000',true),
('60000002-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','ST-TK02','Tank 2 - AGO','tank',300000,'50000002-0000-4000-8000-000000000000',true),
('60000003-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','ST-TK03','Tank 3 - DPK','tank',200000,'50000003-0000-4000-8000-000000000000',true),
('60000004-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','ST-SP01','Sphere 1 - LPG','sphere',500,'50000004-0000-4000-8000-000000000000',true),
('60000005-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','ST-WH01','Lubricants Warehouse','warehouse',null,'50000005-0000-4000-8000-000000000000',true);

-- ---------------------------------------------------------------------------
-- Bank accounts
-- ---------------------------------------------------------------------------
insert into bank_accounts (id, company_id, name, bank_name, account_number, currency, coa_id, opening_balance, is_active) values
('70000001-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','Corporate Current Account','Bank of Commerce','0112-8845-1100','USD','00001100-0000-4000-8000-000000000000',2500000,true),
('70000002-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','Terminal Operations Account','First Union Bank','0992-2210-5588','USD','00001101-0000-4000-8000-000000000000',1200000,true);

-- ---------------------------------------------------------------------------
-- Fixed assets
-- ---------------------------------------------------------------------------
insert into assets (id, company_id, code, name, category, location, purchase_date, cost, salvage_value, useful_life_months, depreciation_method, accumulated_depreciation, status) values
('80000001-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','FA-001','Storage Tank 1 - PMS 250KL','Storage Tanks','Tank Farm A','2019-03-15',9500000,500000,240,'straight_line',2700000,'active'),
('80000002-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','FA-002','Storage Tank 2 - AGO 300KL','Storage Tanks','Tank Farm A','2019-03-15',11000000,600000,240,'straight_line',3200000,'active'),
('80000003-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','FA-003','Bottom Loading Gantry','Loading Equipment','Gantry 1','2020-07-20',4300000,200000,180,'straight_line',1750000,'active'),
('80000004-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','FA-004','Loading Arms Set (LPG)','Loading Equipment','Gantry 2','2021-01-10',2900000,150000,180,'straight_line',800000,'active'),
('80000005-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','FA-005','Firewater Pump & Deluge System','Plant & Equipment','Pump House','2019-11-05',1800000,100000,180,'straight_line',700000,'active'),
('80000006-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','FA-006','Fuel Truck - Diesel 45KL','Vehicles','Transport Yard','2022-04-18',1550000,80000,120,'straight_line',330000,'active'),
('80000007-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','FA-007','Terminal Office Building','Buildings','Admin Block','2018-06-01',7200000,500000,300,'straight_line',2200000,'active'),
('80000008-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','FA-008','Control Room SCADA System','Plant & Equipment','Control Room','2022-09-01',2600000,100000,120,'straight_line',420000,'active');

-- ---------------------------------------------------------------------------
-- Departments & employees
-- ---------------------------------------------------------------------------
insert into departments (id, company_id, name) values
('90000001-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','Terminal Operations'),
('90000002-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','Storage & Tanks'),
('90000003-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','Logistics'),
('90000004-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','Maintenance & Engineering'),
('90000005-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','HSE'),
('90000006-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','Finance & Admin'),
('90000007-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','Marketing & Sales');

insert into employees (id, company_id, code, name, department_id, designation, phone, email, join_date, basic_salary, allowances, statutory_deductions, bank_name, bank_account, status) values
('a0000001-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','E-001','John Obi','90000006-0000-4000-8000-000000000000','Finance Manager','+234 810 000 1111','john.obi@meridianrefinery.ng','2019-02-01',32000,8000,3000,'Bank of Commerce','0112-1000-01', 'active'),
('a0000002-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','E-002','Sarah Adeyemi','90000001-0000-4000-8000-000000000000','Terminal Supervisor','+234 810 000 2222','sarah.adeyemi@meridianrefinery.ng','2020-05-01',26000,5000,2400,'First Union Bank','0992-1000-02','active'),
('a0000003-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','E-003','David Musa','90000002-0000-4000-8000-000000000000','Tank Farm Operator','+234 810 000 3333','david.musa@meridianrefinery.ng','2021-01-15',18000,3000,1600,'First Union Bank','0992-1000-03','active'),
('a0000004-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','E-004','Fatima Bello','90000004-0000-4000-8000-000000000000','Maintenance Engineer','+234 810 000 4444','fatima.bello@meridianrefinery.ng','2020-09-01',28000,6000,2600,'Bank of Commerce','0112-1000-04','active'),
('a0000005-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','E-005','Chinedu Okafor','90000005-0000-4000-8000-000000000000','HSE Officer','+234 810 000 5555','chinedu.okafor@meridianrefinery.ng','2021-04-01',22000,4000,2000,'First Union Bank','0992-1000-05','active'),
('a0000006-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','E-006','Grace Nwosu','90000003-0000-4000-8000-000000000000','Logistics Coordinator','+234 810 000 6666','grace.nwosu@meridianrefinery.ng','2022-02-01',20000,4000,1900,'Bank of Commerce','0112-1000-06','active'),
('a0000007-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','E-007','Peter Enahoro','90000007-0000-4000-8000-000000000000','Sales Executive','+234 810 000 7777','peter.enahoro@meridianrefinery.ng','2022-06-01',19000,3500,1800,'First Union Bank','0992-1000-07','active'),
('a0000008-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','E-008','Amina Suleiman','90000006-0000-4000-8000-000000000000','Accountant','+234 810 000 8888','amina.suleiman@meridianrefinery.ng','2023-03-01',24000,4500,2200,'Bank of Commerce','0112-1000-08','active');

-- ---------------------------------------------------------------------------
-- Approval rules
-- ---------------------------------------------------------------------------
insert into approval_rules (company_id, min_amount, max_amount, role) values
('00000000-0000-4000-8000-000000000001',0,10000,'accountant'),
('00000000-0000-4000-8000-000000000001',10000,100000,'manager'),
('00000000-0000-4000-8000-000000000001',100000,1000000,'director'),
('00000000-0000-4000-8000-000000000001',1000000,null,'admin');

-- ---------------------------------------------------------------------------
-- Opening inventory movements
-- ---------------------------------------------------------------------------
insert into inventory_transactions (id, company_id, product_id, storage_id, type, quantity, unit_cost, total_value, reference_type, trx_date, notes) values
('b0000001-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','50000001-0000-4000-8000-000000000000','60000001-0000-4000-8000-000000000000','opening',2000000,1.02,2040000,'opening','2026-01-01','Opening stock'),
('b0000002-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','50000002-0000-4000-8000-000000000000','60000002-0000-4000-8000-000000000000','opening',1500000,1.08,1620000,'opening','2026-01-01','Opening stock'),
('b0000003-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','50000003-0000-4000-8000-000000000000','60000003-0000-4000-8000-000000000000','opening',400000,1.00,400000,'opening','2026-01-01','Opening stock'),
('b0000004-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','50000004-0000-4000-8000-000000000000','60000004-0000-4000-8000-000000000000','opening',200,900.00,180000,'opening','2026-01-01','Opening stock'),
('b0000005-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','50000005-0000-4000-8000-000000000000','60000005-0000-4000-8000-000000000000','opening',10000,4.50,45000,'opening','2026-01-01','Opening stock');

-- ---------------------------------------------------------------------------
-- Posted journal entries for the current period (May - Jul 2026)
-- ---------------------------------------------------------------------------

-- JE-00001: Diesel purchase from Delta (inventory in)
insert into journal_entries (id, company_id, entry_no, entry_date, type, reference, description, status, approval_status, total_debit, total_credit, posted_at) values
('ea000001-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','GL-2026-00001','2026-06-05','purchase','BILL-2026-00001','Diesel AGO purchase - Delta Crude, 1,000,000 L @ 1.20','posted','not_required',1260000,1260000,now());
insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values
('ea000001-0000-4000-8000-000000000000','00001300-0000-4000-8000-000000000000','Diesel AGO inventory',1200000,0),
('ea000001-0000-4000-8000-000000000000','00002310-0000-4000-8000-000000000000','VAT recoverable 5%',60000,0),
('ea000001-0000-4000-8000-000000000000','00002100-0000-4000-8000-000000000000','Supplier payable',0,1260000);

-- JE-00002: PMS sale to Meridian
insert into journal_entries (id, company_id, entry_no, entry_date, type, reference, description, status, approval_status, total_debit, total_credit, posted_at) values
('ea000002-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','GL-2026-00002','2026-06-10','sale','INV-2026-00001','PMS sale - Meridian Oil & Gas, 500,000 L @ 1.60','posted','not_required',840000,840000,now());
insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values
('ea000002-0000-4000-8000-000000000000','00001200-0000-4000-8000-000000000000','Receivable - Meridian',840000,0),
('ea000002-0000-4000-8000-000000000000','00004000-0000-4000-8000-000000000000','PMS sales revenue',0,800000),
('ea000002-0000-4000-8000-000000000000','00002300-0000-4000-8000-000000000000','VAT output 5%',0,40000);

-- JE-00003: AGO sale to Atlas
insert into journal_entries (id, company_id, entry_no, entry_date, type, reference, description, status, approval_status, total_debit, total_credit, posted_at) values
('ea000003-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','GL-2026-00003','2026-06-18','sale','INV-2026-00002','AGO sale - Atlas Petroleum, 300,000 L @ 1.50','posted','not_required',472500,472500,now());
insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values
('ea000003-0000-4000-8000-000000000000','00001200-0000-4000-8000-000000000000','Receivable - Atlas',472500,0),
('ea000003-0000-4000-8000-000000000000','00004000-0000-4000-8000-000000000000','AGO sales revenue',0,450000),
('ea000003-0000-4000-8000-000000000000','00002300-0000-4000-8000-000000000000','VAT output 5%',0,22500);

-- JE-00004: Receipt from Meridian (full settlement of INV-2026-00001)
insert into journal_entries (id, company_id, entry_no, entry_date, type, reference, description, status, approval_status, total_debit, total_credit, posted_at) values
('ea000004-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','GL-2026-00004','2026-06-25','receipt','PMT-2026-00001','Receipt from Meridian Oil & Gas - INV-2026-00001','posted','not_required',840000,840000,now());
insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values
('ea000004-0000-4000-8000-000000000000','00001100-0000-4000-8000-000000000000','Bank - Corporate Current',840000,0),
('ea000004-0000-4000-8000-000000000000','00001200-0000-4000-8000-000000000000','Receivable - Meridian',0,840000);

-- JE-00005: Payment to Delta (partial)
insert into journal_entries (id, company_id, entry_no, entry_date, type, reference, description, status, approval_status, total_debit, total_credit, posted_at) values
('ea000005-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','GL-2026-00005','2026-06-28','payment','PMT-2026-00002','Payment to Delta Crude - BILL-2026-00001','posted','not_required',600000,600000,now());
insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values
('ea000005-0000-4000-8000-000000000000','00002100-0000-4000-8000-000000000000','Payable - Delta Crude',600000,0),
('ea000005-0000-4000-8000-000000000000','00001100-0000-4000-8000-000000000000','Bank - Corporate Current',0,600000);

-- JE-00006: July salaries accrual
insert into journal_entries (id, company_id, entry_no, entry_date, type, reference, description, status, approval_status, total_debit, total_credit, posted_at) values
('ea000006-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','GL-2026-00006','2026-07-31','payroll','PAY-2026-07','July 2026 staff salaries','posted','not_required',223000,223000,now());
insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values
('ea000006-0000-4000-8000-000000000000','00006010-0000-4000-8000-000000000000','Staff salaries',189000,0),
('ea000006-0000-4000-8000-000000000000','00006020-0000-4000-8000-000000000000','Staff allowances',34000,0),
('ea000006-0000-4000-8000-000000000000','00002200-0000-4000-8000-000000000000','Accrued salaries',0,223000);

-- JE-00007: Depreciation for half year
insert into journal_entries (id, company_id, entry_no, entry_date, type, reference, description, status, approval_status, total_debit, total_credit, posted_at) values
('ea000007-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','GL-2026-00007','2026-07-31','depreciation','FA-DEP-2026H1','Half year depreciation - terminal assets','posted','not_required',540000,540000,now());
insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values
('ea000007-0000-4000-8000-000000000000','00006100-0000-4000-8000-000000000000','Depreciation expense',540000,0),
('ea000007-0000-4000-8000-000000000000','00001420-0000-4000-8000-000000000000','Accumulated depreciation',0,540000);

-- JE-00008: Haulage expense (TransTank)
insert into journal_entries (id, company_id, entry_no, entry_date, type, reference, description, status, approval_status, total_debit, total_credit, posted_at) values
('ea000008-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','GL-2026-00008','2026-07-12','purchase','BILL-2026-00002','Haulage services - TransTank','posted','not_required',47250,47250,now());
insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values
('ea000008-0000-4000-8000-000000000000','00006070-0000-4000-8000-000000000000','Transport & logistics',45000,0),
('ea000008-0000-4000-8000-000000000000','00002310-0000-4000-8000-000000000000','VAT recoverable',2250,0),
('ea000008-0000-4000-8000-000000000000','00002100-0000-4000-8000-000000000000','Payable - TransTank',0,47250);

-- JE-00009: Utility expense (electricity)
insert into journal_entries (id, company_id, entry_no, entry_date, type, reference, description, status, approval_status, total_debit, total_credit, posted_at) values
('ea000009-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','GL-2026-00009','2026-07-20','expense','UTIL-JUL','Electricity & water - July','posted','not_required',78000,78000,now());
insert into journal_entry_lines (entry_id, account_id, description, debit, credit) values
('ea000009-0000-4000-8000-000000000000','00006030-0000-4000-8000-000000000000','Utilities',78000,0),
('ea000009-0000-4000-8000-000000000000','00002200-0000-4000-8000-000000000000','Accrued utilities',0,78000);

-- ---------------------------------------------------------------------------
-- Invoices (sales) with linked journal entries
-- ---------------------------------------------------------------------------
insert into invoices (id, company_id, invoice_no, invoice_date, due_date, customer_id, subtotal, discount_amount, tax_amount, total, amount_paid, status, approval_status, journal_entry_id, created_at) values
('f1000001-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','INV-2026-00001','2026-06-10','2026-07-10','10000001-0000-4000-8000-000000000000',800000,0,40000,840000,840000,'paid','not_required','ea000002-0000-4000-8000-000000000000',now()),
('f1000002-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','INV-2026-00002','2026-06-18','2026-07-18','10000002-0000-4000-8000-000000000000',450000,0,22500,472500,0,'issued','not_required','ea000003-0000-4000-8000-000000000000',now());

insert into invoice_lines (invoice_id, product_id, description, quantity, unit_price, discount, tax_rate, tax_amount, line_total) values
('f1000001-0000-4000-8000-000000000000','50000001-0000-4000-8000-000000000000','Premium Motor Spirit (PMS)',500000,1.60,0,5,40000,800000),
('f1000002-0000-4000-8000-000000000000','50000002-0000-4000-8000-000000000000','Automotive Gas Oil (AGO)',300000,1.50,0,5,22500,450000);

-- ---------------------------------------------------------------------------
-- Purchase invoices with linked journal entries
-- ---------------------------------------------------------------------------
insert into purchase_invoices (id, company_id, bill_no, bill_date, due_date, supplier_id, subtotal, discount_amount, tax_amount, total, amount_paid, status, approval_status, journal_entry_id, created_at) values
('f2000001-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','BILL-2026-00001','2026-06-05','2026-07-05','20000001-0000-4000-8000-000000000000',1200000,0,60000,1260000,600000,'partially_paid','not_required','ea000001-0000-4000-8000-000000000000',now()),
('f2000002-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','BILL-2026-00002','2026-07-12','2026-08-11','20000003-0000-4000-8000-000000000000',45000,0,2250,47250,0,'issued','not_required','ea000008-0000-4000-8000-000000000000',now());

insert into purchase_invoice_lines (purchase_invoice_id, product_id, description, quantity, unit_price, discount, tax_rate, tax_amount, line_total) values
('f2000001-0000-4000-8000-000000000000','50000002-0000-4000-8000-000000000000','Automotive Gas Oil (AGO)',1000000,1.20,0,5,60000,1200000),
('f2000002-0000-4000-8000-000000000000',null,'Haulage services - monthly contract',1,45000,0,5,2250,45000);

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
insert into payments (id, company_id, payment_no, payment_date, type, party_type, party_id, invoice_id, purchase_invoice_id, bank_account_id, amount, method, reference, created_at) values
('d0000001-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','PMT-2026-00001','2026-06-25','incoming','customer','10000001-0000-4000-8000-000000000000','f1000001-0000-4000-8000-000000000000',null,'70000001-0000-4000-8000-000000000000',840000,'bank_transfer','RTGS-889021',now()),
('d0000002-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','PMT-2026-00002','2026-06-28','outgoing','supplier','20000001-0000-4000-8000-000000000000',null,'f2000001-0000-4000-8000-000000000000','70000001-0000-4000-8000-000000000000',600000,'bank_transfer','WIRE-450119',now());

-- ---------------------------------------------------------------------------
-- Inventory movements for the period
-- ---------------------------------------------------------------------------
insert into inventory_transactions (id, company_id, product_id, storage_id, type, quantity, unit_cost, total_value, reference_type, reference_id, trx_date, notes) values
('b0000011-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','50000002-0000-4000-8000-000000000000','60000002-0000-4000-8000-000000000000','purchase',1000000,1.20,1200000,'purchase_invoice','f2000001-0000-4000-8000-000000000000','2026-06-05','AGO intake from Delta Crude'),
('b0000012-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','50000001-0000-4000-8000-000000000000','60000001-0000-4000-8000-000000000000','sale',-500000,1.02,510000,'invoice','f1000001-0000-4000-8000-000000000000','2026-06-10','PMS dispatch to Meridian'),
('b0000013-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','50000002-0000-4000-8000-000000000000','60000002-0000-4000-8000-000000000000','sale',-300000,1.08,324000,'invoice','f1000002-0000-4000-8000-000000000000','2026-06-18','AGO dispatch to Atlas');
