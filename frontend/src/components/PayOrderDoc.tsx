import React from 'react';

const company = {
  name: 'Pakistan Refinery Limited',
  legalName: 'PAKISTAN REFINERY LIMITED',
  address: 'Korangi Creek, P.O. Box 4612, Karachi - 74900, Pakistan',
  ntn: 'NTN-0001234-5',
  email: 'info@prl.com.pk',
  phone: '(021) 9911-0600',
};

export const formalDate = (d?: string | null): string => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
};

export const pkr = (n: number | string | null | undefined): string =>
  `Rs. ${Number(n ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface PayOrderDocProps {
  item: any;
  lines: any[];
}

export const PayOrderDoc: React.FC<PayOrderDocProps> = ({ item, lines }) => {
  const rows = lines && lines.length ? lines : [{ description: item.narrative || 'Surveying Services', invoice_no: '', invoice_date: null, tanker_name: '', amount: item.amount }];
  const total = Number(item.amount ?? 0);

  return (
    <div className="pay-order-doc bg-white text-slate-900 text-[13px] leading-snug" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
      {/* Letterhead */}
      <div className="flex items-start gap-4 border-b-4 pb-3" style={{ borderColor: '#0b6b2d' }}>
        <img src="/prl-logo.png" alt="PRL" className="h-16 w-auto object-contain" />
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold tracking-wide" style={{ color: '#2e3c8f' }}>{company.name.toUpperCase()}</h1>
          <p className="text-[11px] uppercase tracking-widest mt-0.5" style={{ color: '#0b74b8' }}>{company.legalName}</p>
          <p className="text-[11px] mt-1">{company.address}</p>
          <p className="text-[11px]">
            Tel: {company.phone} · Email: {company.email} · NTN: {company.ntn}
          </p>
        </div>
        <div className="w-24 shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Form</p>
          <p className="text-lg font-bold" style={{ color: '#d71920' }}>F.D. 310</p>
        </div>
      </div>

      {/* Title */}
      <div className="my-3 text-center">
        <span className="inline-block border border-slate-800 px-10 py-1.5 text-lg font-bold tracking-[0.25em]" style={{ color: '#2e3c8f' }}>
          PAY ORDER
        </span>
      </div>

      {/* Meta row */}
      <div className="flex justify-between items-center border border-slate-400 bg-slate-50 px-3 py-1.5 text-[12px]">
        <span><b>Pay Order No:</b> {item.pay_order_no}</span>
        <span><b>Date:</b> {formalDate(item.issued_at || item.created_at)}</span>
        <span><b>Serial No:</b> {item.serial_no || item.pay_order_no.replace(/\D/g, '').slice(-6) || '—'}</span>
        <span><b>Status:</b> {(item.status || 'draft').toUpperCase()}</span>
      </div>

      {/* Payee */}
      <div className="mt-3 grid grid-cols-1 gap-1.5">
        <div className="flex">
          <span className="w-28 shrink-0 font-bold">PAY TO</span>
          <div className="flex-1 border-b border-slate-500 px-2 font-semibold uppercase">{item.vendor}</div>
        </div>
        <div className="flex">
          <span className="w-28 shrink-0 font-bold">AMOUNT (FIGURES)</span>
          <div className="flex-1 border-b border-slate-500 px-2 font-semibold">{pkr(total)}</div>
        </div>
        <div className="flex items-start">
          <span className="w-28 shrink-0 font-bold">AMOUNT (WORDS)</span>
          <div className="flex-1 border-b border-slate-500 px-2 font-semibold uppercase">{item.amount_in_words || '—'}</div>
        </div>
        <div className="flex">
          <span className="w-28 shrink-0 font-bold">BY PAYMENT</span>
          <div className="flex-1 border-b border-slate-500 px-2">
            {(item.pay_method || 'cheque').toUpperCase()}
            {item.pay_method === 'cheque' && item.cheque_no ? ` — CHEQUE NO. ${item.cheque_no}` : ''}
            {item.order_no ? ` — A/C REF. ${item.order_no}` : ''}
          </div>
        </div>
      </div>

      {/* Narrative */}
      <p className="mt-3">
        <b>On Account Of: </b>
        <span className="border-b border-slate-500 px-1">
          {item.narrative || `ON ACCOUNT OF PAYMENT IN RESPECT OF SURVEYING SERVICES - ${item.vendor}`}
        </span>
      </p>

      {/* Lines table */}
      <table className="w-full mt-3 border-collapse">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider" style={{ background: '#eef1fb', color: '#2e3c8f' }}>
            <th className="border border-slate-400 px-2 py-1.5">#</th>
            <th className="border border-slate-400 px-2 py-1.5">Description</th>
            <th className="border border-slate-400 px-2 py-1.5">Invoice No</th>
            <th className="border border-slate-400 px-2 py-1.5">Invoice Date</th>
            <th className="border border-slate-400 px-2 py-1.5">Tanker</th>
            <th className="border border-slate-400 px-2 py-1.5 text-right">Amount (PKR)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l: any, i: number) => (
            <tr key={l.id || i} className="break-inside-avoid">
              <td className="border border-slate-400 px-2 py-1.5 text-center">{i + 1}</td>
              <td className="border border-slate-400 px-2 py-1.5">{l.description || 'Surveying Services'}</td>
              <td className="border border-slate-400 px-2 py-1.5">{l.invoice_no || '—'}</td>
              <td className="border border-slate-400 px-2 py-1.5">{formalDate(l.invoice_date)}</td>
              <td className="border border-slate-400 px-2 py-1.5">{l.tanker_name || '—'}</td>
              <td className="border border-slate-400 px-2 py-1.5 text-right tabular-nums">{Number(l.amount || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          ))}
          <tr className="font-bold break-inside-avoid">
            <td colSpan={5} className="border border-slate-400 px-2 py-1.5 text-right uppercase" style={{ background: '#eef1fb', color: '#2e3c8f' }}>
              Total Payable
            </td>
            <td className="border border-slate-400 px-2 py-1.5 text-right tabular-nums" style={{ background: '#eef1fb', color: '#2e3c8f' }}>
              {total.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Approval chain */}
      <div className="mt-3">
        <p className="text-[11px] italic text-slate-600">Certified that the goods/services covered by the above invoices have been received and the payment is due.</p>
        <p className="text-[11px] mt-0.5 text-slate-600">
          {item.approved_by_name ? `Approved by: ${item.approved_by_name}` : 'Approved by: __________________'}
          {item.finance_passed_by_name ? ` · Finance passed by: ${item.finance_passed_by_name}` : ' · Finance passed by: __________________'}
        </p>
      </div>

      {/* Signatures */}
      <div className="mt-8 grid grid-cols-3 gap-6">
        <div className="text-center">
          <div className="border-t border-slate-500 pt-1.5">
            <p className="font-bold">PREPARED BY</p>
            <p className="text-[10px] text-slate-600">Name / Designation / Date</p>
          </div>
        </div>
        <div className="text-center">
          <div className="border-t border-slate-500 pt-1.5">
            <p className="font-bold">CHECKED BY</p>
            <p className="text-[10px] text-slate-600">Name / Designation / Date</p>
          </div>
        </div>
        <div className="text-center">
          <div className="border-t border-slate-500 pt-1.5">
            <p className="font-bold">AUTHORIZED SIGNATORY</p>
            <p className="text-[10px] text-slate-600">Name / Designation / Date</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 border-t border-slate-300 pt-1.5 text-center text-[10px] text-slate-500">
        {company.legalName} · {company.address} · NTN: {company.ntn}
      </div>
    </div>
  );
};
