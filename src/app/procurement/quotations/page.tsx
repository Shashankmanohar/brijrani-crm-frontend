'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { PurchaseQuotation } from '../../../types/erp';
import DataTable from '../../../components/shared/DataTable';
import { FileSpreadsheet, Plus, HelpCircle, FileCheck, ArrowDown, Download, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { jsPDF } from 'jspdf';

export default function PurchaseQuotationsPage() {
  const router = useRouter();
  const { db, refreshDb, showToast } = useErp();
  const [selectedPQ, setSelectedPQ] = useState<PurchaseQuotation | null>(null);
  const [comparisonCommodityId, setComparisonCommodityId] = useState('CMD-001'); // Wheat
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [partyType, setPartyType] = useState<'supplier' | 'farmer'>('supplier');
  const [partyId, setPartyId] = useState('');
  const [commodityId, setCommodityId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [rate, setRate] = useState(0);
  const [transportCost, setTransportCost] = useState(0);
  const [loadingCost, setLoadingCost] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');

  const suppliers = db.suppliers;
  const farmers = db.farmers;
  const commodities = db.commodities;

  // Sync comparisonCommodityId with actual MongoDB ObjectId from backend/context
  useEffect(() => {
    if (commodities.length > 0) {
      const wheat = commodities.find(c => c.sku === 'CMD-001');
      if (wheat) {
        setComparisonCommodityId(wheat.id);
      } else {
        setComparisonCommodityId(commodities[0].id);
      }
    }
  }, [commodities]);

  const activeParties = partyType === 'supplier' ? suppliers : farmers;

  // Calculate totals for new PQ
  const subtotal = quantity * rate;
  const extra = Number(transportCost) + Number(loadingCost) + Number(otherCharges);
  const gstAmt = Math.round((subtotal + extra) * 0.05); // 5% GST
  const grandTotal = subtotal + extra + gstAmt;

  const handleCreatePQ = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId || !commodityId) {
      showToast('Please fill all mandatory fields', 'error');
      return;
    }

    const quotationNo = `PQ/BR/2026-27/${String(db.purchaseQuotations.length + 1).padStart(3, '0')}`;
    const id = `PQ-${Date.now()}`;
    const date = new Date().toISOString().split('T')[0];

    const newPQ: PurchaseQuotation = {
      id,
      quotationNo,
      date,
      partyType,
      partyId,
      commodityId,
      quantity,
      rate,
      transportCost,
      loadingCost,
      otherCharges,
      gstPercent: 5,
      total: grandTotal,
      validUntil,
      paymentTerms,
      deliveryTerms,
      status: 'Sent'
    };

    erpService.purchaseQuotations.create(newPQ);
    refreshDb();
    setIsCreateOpen(false);
    showToast(`Quotation ${quotationNo} logged successfully!`, 'success');
  };

  // Filter quotes matching comparison commodity
  const compareQuotes = useMemo(() => {
    return db.purchaseQuotations.filter(q => q.commodityId === comparisonCommodityId);
  }, [db.purchaseQuotations, comparisonCommodityId]);

  // Find lowest price quote
  const lowestBid = useMemo(() => {
    if (compareQuotes.length === 0) return null;
    return [...compareQuotes].sort((a, b) => a.rate - b.rate)[0];
  }, [compareQuotes]);

  const columns = [
    { header: 'Quotation No', accessor: 'quotationNo' as keyof PurchaseQuotation, sortable: true },
    { 
      header: 'Supplier/Farmer', 
      accessor: (row: PurchaseQuotation) => {
        if (row.partyType === 'supplier') {
          return suppliers.find(s => s.id === row.partyId)?.name || 'Unknown';
        }
        return farmers.find(f => f.id === row.partyId)?.name || 'Unknown';
      }
    },
    { 
      header: 'Commodity', 
      accessor: (row: PurchaseQuotation) => commodities.find(c => c.id === row.commodityId)?.name || 'Unknown'
    },
    { header: 'Qty (MT)', accessor: 'quantity' as keyof PurchaseQuotation },
    { header: 'Rate/MT', accessor: (row: PurchaseQuotation) => `₹${row.rate.toLocaleString()}` },
    { header: 'Grand Value', accessor: (row: PurchaseQuotation) => `₹${row.total.toLocaleString()}` },
    { header: 'Valid Until', accessor: 'validUntil' as keyof PurchaseQuotation },
    { 
      header: 'Status', 
      accessor: (row: PurchaseQuotation) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.status === 'Converted' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
          row.status === 'Rejected' ? 'bg-red-50 text-red-600 border-red-200' :
          'bg-amber-50 text-amber-600 border-amber-200'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  const handleConvertPO = (pq: PurchaseQuotation) => {
    // Generate PO
    const poNo = `PO/BR/2026-27/${String(db.purchaseOrders.length + 1).padStart(3, '0')}`;
    const id = `PO-${Date.now()}`;
    const date = new Date().toISOString().split('T')[0];

    erpService.purchaseOrders.create({
      id,
      poNo,
      quotationNo: pq.quotationNo,
      date,
      partyType: pq.partyType,
      partyId: pq.partyId,
      commodityId: pq.commodityId,
      quantity: pq.quantity,
      rate: pq.rate,
      transportCost: pq.transportCost,
      otherCharges: pq.loadingCost + pq.otherCharges,
      gstPercent: pq.gstPercent,
      total: pq.total,
      expectedDelivery: pq.validUntil,
      warehouseId: 'WH-001',
      status: pq.total >= 1000000 ? 'Pending Approval' : 'Approved',
      approvalHistory: [{ step: 'Creation', user: 'Purchasing Department', action: 'Created', date }]
    });

    pq.status = 'Converted';
    erpService.purchaseQuotations.update(pq);

    refreshDb();
    showToast(`Quotation approved and converted to Purchase Order ${poNo}!`, 'success');
    router.push('/procurement/orders');
  };

  const printQuotationPDF = (pq: PurchaseQuotation) => {
    const doc = new jsPDF();

    // Fonts and Branding
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text("BRIJRANI AGRO FOODS LTD", 14, 20);

    // Subtitle
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text("Patna Bypass Road, Didarganj, Patna, Bihar, 800008", 14, 26);
    doc.text("Email: trade@brijranierp.com | Phone: +91 9988776655", 14, 31);

    // Decorative line
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 36, 196, 36);

    // Quote Header
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("PURCHASE PRICE QUOTATION", 14, 46);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Quotation No:   ${pq.quotationNo}`, 14, 53);
    doc.text(`Doc Date:       ${pq.date}`, 14, 59);
    doc.text(`Valid Until:    ${pq.validUntil}`, 14, 65);
    doc.text(`Doc Status:     ${pq.status}`, 14, 71);

    // Vendor details
    const vendorName = pq.partyType === 'supplier'
      ? suppliers.find(s => s.id === pq.partyId)?.name
      : farmers.find(f => f.id === pq.partyId)?.name;
      
    doc.setFont("Helvetica", "bold");
    doc.text("VENDOR / SOURCING PARTY:", 14, 83);
    doc.setFont("Helvetica", "normal");
    doc.text(vendorName || 'Unknown Vendor', 14, 89);
    doc.text(`Sourcing Channel: ${pq.partyType.toUpperCase()}`, 14, 94);

    // Items table header
    const tableTop = 105;
    doc.setFillColor(248, 250, 252);
    doc.rect(14, tableTop, 182, 8, "F");
    
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Quoted Commodity Description", 16, tableTop + 5.5);
    doc.text("Qty", 120, tableTop + 5.5, { align: "right" });
    doc.text("Quoted Rate", 155, tableTop + 5.5, { align: "right" });
    doc.text("Estimated Net Value", 194, tableTop + 5.5, { align: "right" });

    // Table divider
    doc.setDrawColor(203, 213, 225);
    doc.line(14, tableTop + 8, 196, tableTop + 8);

    // Item line
    const itemY = tableTop + 14;
    const commName = commodities.find(c => c.id === pq.commodityId)?.name || 'Unknown';
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(commName, 16, itemY);
    doc.setFont("Helvetica", "normal");
    doc.text(`${pq.quantity} MT`, 120, itemY, { align: "right" });
    doc.text(`₹${pq.rate.toLocaleString()} / MT`, 155, itemY, { align: "right" });
    doc.text(`₹${(pq.quantity * pq.rate).toLocaleString()}`, 194, itemY, { align: "right" });

    // Pricing details block
    const summaryX = 135;
    let summaryY = itemY + 15;
    doc.setDrawColor(226, 232, 240);
    doc.line(14, summaryY - 3, 196, summaryY - 3);

    doc.setFont("Helvetica", "normal");
    doc.text("Base Value:", summaryX, summaryY);
    doc.text(`₹${(pq.quantity * pq.rate).toLocaleString()}`, 194, summaryY, { align: "right" });
    summaryY += 6;

    doc.text("Transport Cost:", summaryX, summaryY);
    doc.text(`₹${pq.transportCost.toLocaleString()}`, 194, summaryY, { align: "right" });
    summaryY += 6;

    doc.text("Loading/Surcharges:", summaryX, summaryY);
    doc.text(`₹${(pq.loadingCost + pq.otherCharges).toLocaleString()}`, 194, summaryY, { align: "right" });
    summaryY += 6;

    const gstVal = Math.round(((pq.quantity * pq.rate) + pq.transportCost + pq.loadingCost + pq.otherCharges) * 0.05);
    doc.text(`GST (5%):`, summaryX, summaryY);
    doc.text(`₹${gstVal.toLocaleString()}`, 194, summaryY, { align: "right" });
    summaryY += 8;

    // Grand total
    doc.line(120, summaryY - 2, 196, summaryY - 2);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Grand Total:", summaryX, summaryY + 2);
    doc.text(`₹${pq.total.toLocaleString()}`, 194, summaryY + 2, { align: "right" });
    summaryY += 15;

    // Terms
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("COMMERCIAL TERMS:", 14, summaryY);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Payment Terms: ${pq.paymentTerms || 'Standard Net 30 days'}`, 14, summaryY + 6);
    doc.text(`Delivery Terms: ${pq.deliveryTerms || 'FOB Warehouse Destination Silo'}`, 14, summaryY + 12);

    // Footer
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("This is an electronically generated price quotation comparison voucher.", 14, 280);

    doc.save(`purchase_quotation_${pq.quotationNo.replace(/\//g, '_')}.pdf`);
    showToast(`Quotation ${pq.quotationNo} PDF downloaded successfully!`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Purchase Quotations Comparison</h1>
          <p className="text-xs font-medium text-slate-400">Evaluate multiple vendor quotes side-by-side and select the best bid pricing.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Log New Quotation</span>
        </button>
      </div>

      {/* Comparison Grid (Section 5) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Side-by-Side Sourcing Comparison</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Select a commodity to compare rates, transport, loading and grand totals.</p>
          </div>
          <div>
            <select
              value={comparisonCommodityId}
              onChange={e => setComparisonCommodityId(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none font-medium text-slate-700"
            >
              {commodities.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {compareQuotes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {compareQuotes.map(q => {
              const vendorName = q.partyType === 'supplier'
                ? suppliers.find(s => s.id === q.partyId)?.name
                : farmers.find(f => f.id === q.partyId)?.name;
              const isBest = lowestBid && q.id === lowestBid.id;

              return (
                <div 
                  key={q.id}
                  className={`border rounded-xl p-4 shadow-sm flex flex-col justify-between ${
                    isBest 
                      ? 'border-emerald-500 bg-emerald-50/10 ring-2 ring-emerald-100' 
                      : 'border-slate-150'
                  }`}
                >
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-xs text-slate-800">{vendorName}</h4>
                        <span className="text-[9px] text-slate-400 block mt-0.5">{q.quotationNo}</span>
                      </div>
                      {isBest && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-250 text-[9px] font-bold uppercase tracking-wider animate-pulse">
                          <ArrowDown size={10} /> Lowest Bid
                        </span>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs text-slate-655 font-semibold">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Offer Rate:</span>
                        <span>₹{q.rate.toLocaleString()} / MT</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Transport Freight:</span>
                        <span>₹{q.transportCost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Loading / Surcharges:</span>
                        <span>₹{(q.loadingCost + q.otherCharges).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-800 font-bold border-t border-slate-100 pt-1.5">
                        <span>Grand Total:</span>
                        <span>₹{q.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {q.status === 'Sent' && (
                    <button
                      onClick={() => handleConvertPO(q)}
                      className="w-full mt-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-[10px] flex items-center justify-center gap-1 shadow-sm transition cursor-pointer"
                    >
                      <FileCheck size={12} />
                      <span>Convert to PO</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-400 font-semibold leading-relaxed border border-dashed border-slate-200 rounded-xl">
            No quotations found for this commodity. Log new vendor quotes first.
          </div>
        )}
      </div>

      {/* Main Grid: Sourcing List (Left) & Quotation Details (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DataTable
            data={db.purchaseQuotations}
            columns={columns}
            searchPlaceholder="Search quotations..."
            searchField="quotationNo"
            onRowClick={(row) => setSelectedPQ(row)}
            exportFileName="purchase_quotations_list"
          />
        </div>

        {/* Quotation Details Drawer (Right) */}
        <div>
          {selectedPQ ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 animate-fade-in">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{selectedPQ.quotationNo}</h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Date: {selectedPQ.date}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-800 block">₹{selectedPQ.total.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-400 block font-semibold">Includes 5% GST</span>
                </div>
              </div>

              {/* Vendor details */}
              <div className="space-y-2 text-xs font-semibold text-slate-600">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Sourcing Party:</span>
                  <span className="text-slate-800">
                    {selectedPQ.partyType === 'supplier' 
                      ? suppliers.find(s => s.id === selectedPQ.partyId)?.name 
                      : farmers.find(f => f.id === selectedPQ.partyId)?.name}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Channel:</span>
                  <span className="capitalize">{selectedPQ.partyType}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Valid Until:</span>
                  <span>{selectedPQ.validUntil}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Payment Terms:</span>
                  <span>{selectedPQ.paymentTerms || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Delivery Terms:</span>
                  <span>{selectedPQ.deliveryTerms || 'N/A'}</span>
                </div>
              </div>

              {/* Items Card */}
              <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-3.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quoted Price Breakdown</span>
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block">
                      {commodities.find(c => c.id === selectedPQ.commodityId)?.name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Rate: ₹{(selectedPQ.rate).toLocaleString()} / MT
                    </span>
                  </div>
                  <span className="font-bold text-slate-700">
                    {selectedPQ.quantity} MT
                  </span>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-1.5 text-[11px] font-medium text-slate-500">
                  <div className="flex justify-between">
                    <span>Base Value:</span>
                    <span>₹{(selectedPQ.quantity * selectedPQ.rate).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transport Cost:</span>
                    <span>₹{selectedPQ.transportCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Loading Cost:</span>
                    <span>₹{selectedPQ.loadingCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Other Charges:</span>
                    <span>₹{selectedPQ.otherCharges.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>GST (5%):</span>
                    <span>₹{Math.round((selectedPQ.quantity * selectedPQ.rate + selectedPQ.transportCost + selectedPQ.loadingCost + selectedPQ.otherCharges) * 0.05).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-2 pt-2">
                {selectedPQ.status === 'Sent' && (
                  <button
                    onClick={() => handleConvertPO(selectedPQ)}
                    className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-primary-600/10 cursor-pointer transition"
                  >
                    <FileCheck size={14} />
                    <span>Convert to Purchase Order (PO)</span>
                  </button>
                )}

                <button
                  onClick={() => printQuotationPDF(selectedPQ)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Download size={14} className="text-red-500" />
                  <span>Download PDF Voucher</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <FileSpreadsheet size={24} className="text-slate-300" />
              <span>Select a Quotation row to view details, convert to PO, or download PDF voucher.</span>
            </div>
          )}
        </div>
      </div>
      {/* Create Modal Drawer */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Log New Sourcing Quotation</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Log custom vendor price quotes to perform comparative analyses.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreatePQ} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                {/* Sourcing type */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Sourcing Channel</label>
                  <select
                    value={partyType}
                    onChange={e => {
                      setPartyType(e.target.value as 'supplier' | 'farmer');
                      setPartyId('');
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                  >
                    <option value="supplier">Commercial Supplier</option>
                    <option value="farmer">Direct Farmer</option>
                  </select>
                </div>

                {/* Party selector */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    {partyType === 'supplier' ? 'Supplier Name' : 'Farmer Name'} *
                  </label>
                  <select
                    value={partyId}
                    onChange={e => setPartyId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                  >
                    <option value="">Select Sourcing Party</option>
                    {activeParties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Commodity selector */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Product Commodity *</label>
                  <select
                    value={commodityId}
                    onChange={e => setCommodityId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    required
                  >
                    <option value="">Select Commodity</option>
                    {commodities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Validity */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Offer Valid Until *</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={validUntil}
                    onChange={e => setValidUntil(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Quantity */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Quantity (MT) *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                    required
                  />
                </div>

                {/* Rate */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Rate per MT (₹) *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={rate}
                    onChange={e => setRate(Math.max(1, Number(e.target.value)))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Transport cost */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Transport Freight (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={transportCost}
                    onChange={e => setTransportCost(Math.max(0, Number(e.target.value)))}
                  />
                </div>

                {/* Loading cost */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Loading Surcharges (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={loadingCost}
                    onChange={e => setLoadingCost(Math.max(0, Number(e.target.value)))}
                  />
                </div>

                {/* Other charges */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Other Charges (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={otherCharges}
                    onChange={e => setOtherCharges(Math.max(0, Number(e.target.value)))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Payment terms */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payment Terms</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value)}
                    placeholder="e.g. Net 30"
                  />
                </div>

                {/* Delivery terms */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Delivery Terms</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={deliveryTerms}
                    onChange={e => setDeliveryTerms(e.target.value)}
                    placeholder="e.g. FOB"
                  />
                </div>
              </div>

              {/* Order total preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-center text-xs font-semibold">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block tracking-wider font-bold">Estimated Quote Total</span>
                  <span className="text-sm font-bold text-slate-800">₹{grandTotal.toLocaleString()}</span>
                </div>
                <div className="text-right text-[10px] text-slate-400 leading-normal font-semibold">
                  <span>Base: ₹{subtotal.toLocaleString()}</span> <br />
                  <span>Freight/Charges: ₹{extra.toLocaleString()}</span> <br />
                  <span>GST (5%): ₹{gstAmt.toLocaleString()}</span>
                </div>
              </div>

              {/* Form submit */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-250 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-md shadow-primary-600/10 transition"
                >
                  Save Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
