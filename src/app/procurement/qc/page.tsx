'use client';

import React, { useState, useMemo } from 'react';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { GRN, QualityInspection } from '../../../types/erp';
import { useRouter } from 'next/navigation';
import { 
  FlaskConical, ClipboardCheck, CheckCircle2, Clock, 
  Search, ShieldAlert, Award, FileSpreadsheet, UserCheck,
  Warehouse, ArrowRight, PackageCheck
} from 'lucide-react';

export default function QualityControlPage() {
  const { db, refreshDb, currentUserRole, showToast } = useErp();
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<GRN | QualityInspection | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Post-QC next-step states
  const [selectedBinId, setSelectedBinId] = useState('');
  const [inwardDone, setInwardDone] = useState<Record<string, boolean>>({});

  // QC Laboratory Form States
  const [isQcOpen, setIsQcOpen] = useState(false);
  const [moisturePercent, setMoisturePercent] = useState(12.5);
  const [purityPercent, setPurityPercent] = useState(98.2);
  const [grade, setGrade] = useState<'A' | 'B' | 'C' | 'Rejected'>('A');
  const [damagePercent, setDamagePercent] = useState(1.2);
  const [foreignMaterialPercent, setForeignMaterialPercent] = useState(0.8);
  const [qualityScore, setQualityScore] = useState(92);
  const [color, setColor] = useState('Bright Yellow');
  const [qcItemsRates, setQcItemsRates] = useState<Record<string, { rejected: number; damaged: number }>>({});

  const commodities = db.commodities;

  // Filter Data
  const pendingGRNs = useMemo(() => {
    return db.grns.filter(g => 
      g.qualityStatus === 'Pending' && 
      (g.grnNo.toLowerCase().includes(searchQuery.toLowerCase()) || 
       g.poNo.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [db.grns, searchQuery]);

  const completedInspections = useMemo(() => {
    return db.qualityInspections.filter(q => 
      q.grnNo.toLowerCase().includes(searchQuery.toLowerCase()) || 
      q.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.inspector?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [db.qualityInspections, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = db.qualityInspections.length;
    const passed = db.qualityInspections.filter(q => q.status === 'Passed').length;
    const rejected = db.qualityInspections.filter(q => q.status === 'Rejected').length;
    
    let avgScore = 0;
    if (total > 0) {
      avgScore = Math.round(db.qualityInspections.reduce((acc, q) => acc + (q.qualityScore || 0), 0) / total);
    }

    return {
      total,
      passed,
      rejected,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 100,
      avgScore,
      pendingCount: db.grns.filter(g => g.qualityStatus === 'Pending').length
    };
  }, [db.qualityInspections, db.grns]);

  // Handle Item click
  const handleSelectGRN = (grn: GRN) => {
    setSelectedItem(grn);
  };

  const handleSelectInspection = (qi: QualityInspection) => {
    setSelectedItem(qi);
  };

  // QC Form change handler
  const handleQcItemChange = (itemId: string, field: 'rejected' | 'damaged', val: number) => {
    setQcItemsRates(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { rejected: 0, damaged: 0 }),
        [field]: val
      }
    }));
  };

  // Launch Audit modal
  const openAuditModal = (grn: GRN) => {
    setSelectedItem(grn);
    setMoisturePercent(12.5);
    setPurityPercent(98.2);
    setGrade('A');
    setDamagePercent(1.2);
    setForeignMaterialPercent(0.8);
    setQualityScore(92);
    setColor('Bright Yellow');
    
    // Reset quantities
    const rates: Record<string, { rejected: number; damaged: number }> = {};
    grn.items.forEach(i => {
      rates[i.item] = { rejected: 0, damaged: 0 };
    });
    setQcItemsRates(rates);
    setIsQcOpen(true);
  };

  // Submit Laboratory QC Inspection
  const handleSubmitQc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !('grnNo' in selectedItem)) return; // Ensure it's a GRN

    const grn = selectedItem as GRN;

    const itemsPayload = grn.items.map(item => {
      const params = qcItemsRates[item.item] || { rejected: 0, damaged: 0 };
      return {
        item: item.item,
        quantity: item.receivedNow,
        moisturePercent,
        grade,
        color,
        foreignMaterialPercent,
        damagePercent,
        purityPercent,
        qualityScore,
        status: grade === 'Rejected' ? 'Rejected' : 'Passed',
        remarks: `Grain quality laboratory audit certificate log.`,
        rejectedQuantity: params.rejected || 0,
        damagedQuantity: params.damaged || 0
      };
    });

    erpService.submitQualityInspection({
      grnId: grn.id,
      status: grade === 'Rejected' ? 'Rejected' : 'Passed',
      remarks: `QC Auditing completed. Moisture: ${moisturePercent}%, Foreign Mat: ${foreignMaterialPercent}%. Grade: ${grade}.`,
      items: itemsPayload,
      qualityScore,
      inspector: currentUserRole || 'Quality Manager'
    });

    refreshDb();
    setIsQcOpen(false);
    setSelectedItem(null);
    showToast(`Laboratory quality audit certificate created for ${grn.grnNo}.`, 'success');
  };

  // Warehouse Inward after QC approval
  const handleInwardAfterQc = (qi: QualityInspection) => {
    const grn = db.grns.find(g => g.id === qi.grnId || g.grnNo === qi.grnNo);
    if (!grn) { showToast('GRN not found', 'error'); return; }
    const binId = selectedBinId || (db.bins && db.bins[0]?.id) || 'N/A';
    erpService.inwardStock(grn.id, binId);
    setInwardDone(prev => ({ ...prev, [qi.id]: true }));
    refreshDb();
    showToast(`Stock inwarded to warehouse for ${qi.grnNo}. Ready to create Purchase Invoice.`, 'success');
  };

  // Fetch commodity name
  const getCommodityName = (id: string) => {
    return commodities.find(c => c.id === id)?.name || id;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FlaskConical className="text-emerald-600" size={22} />
            <span>Quality Control Laboratory Portal</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Log grain moisture analytics, perform physical dockage screenings, and issue Quality Audit Certificates for incoming warehouse arrivals.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Audited</span>
            <span className="text-xl font-bold text-slate-700">{stats.total}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Award size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Lab Score</span>
            <span className="text-xl font-bold text-slate-700">{stats.avgScore} / 100</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pass Rate (%)</span>
            <span className="text-xl font-bold text-slate-700">{stats.passRate}%</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 animate-pulse">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending QC Audits</span>
            <span className="text-xl font-bold text-slate-700">{stats.pendingCount}</span>
          </div>
        </div>
      </div>

      {/* Main Workspace Workspace */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Left Side: List & Search */}
        <div className="col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          
          {/* Tabs and Search */}
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div className="flex gap-2">
              <button
                onClick={() => { setActiveTab('pending'); setSelectedItem(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'pending'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Clock size={14} />
                <span>Pending QC Audits ({pendingGRNs.length})</span>
              </button>
              <button
                onClick={() => { setActiveTab('completed'); setSelectedItem(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'completed'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <ClipboardCheck size={14} />
                <span>Inspection logs ({completedInspections.length})</span>
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search logs..."
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-48 focus:outline-none focus:border-slate-300"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-2.5 top-2.5 text-slate-400" size={12} />
            </div>
          </div>

          {/* List Content */}
          <div className="space-y-2 overflow-y-auto max-h-[500px] pr-1">
            {activeTab === 'pending' ? (
              pendingGRNs.length === 0 ? (
                <div className="text-center py-10 text-xs font-semibold text-slate-400">
                  No arrivals pending lab quality checking. Great job!
                </div>
              ) : (
                pendingGRNs.map(grn => (
                  <div
                    key={grn.id}
                    onClick={() => handleSelectGRN(grn)}
                    className={`border rounded-lg p-3 cursor-pointer transition flex justify-between items-center ${
                      selectedItem?.id === grn.id
                        ? 'border-emerald-500 bg-emerald-50/20'
                        : 'border-slate-150 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800">{grn.grnNo}</span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-slate-100 rounded-full font-bold text-slate-500">
                          PO: {grn.poNo}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold">
                        Arrived: {grn.arrivalDate} | Vehicle: {grn.vehicleNo}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openAuditModal(grn);
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition shadow-sm"
                    >
                      Run Lab Audit
                    </button>
                  </div>
                ))
              )
            ) : (
              completedInspections.length === 0 ? (
                <div className="text-center py-10 text-xs font-semibold text-slate-400">
                  No completed quality inspection logs found.
                </div>
              ) : (
                completedInspections.map(qi => (
                  <div
                    key={qi.id}
                    onClick={() => handleSelectInspection(qi)}
                    className={`border rounded-lg p-3 cursor-pointer transition flex justify-between items-center ${
                      selectedItem?.id === qi.id
                        ? 'border-emerald-500 bg-emerald-50/20'
                        : 'border-slate-150 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800">{qi.grnNo}</span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Audited by {qi.inspector}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold">
                        Date: {qi.date} | Overall Score: {qi.qualityScore}/100
                      </div>
                    </div>
                    <div>
                      {qi.status === 'Passed' ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                          Passed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-50 text-red-600 border border-red-200">
                          Rejected
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>

        {/* Right Side: Detailed Certificate View */}
        <div className="col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm h-fit">
          {selectedItem ? (
            <div className="space-y-4">
              
              {/* Header Details */}
              <div className="border-b border-slate-100 pb-3 flex justify-between items-start">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Lab Report Vouchers</span>
                  <h4 className="text-sm font-bold text-slate-800 mt-0.5">
                    {selectedItem.grnNo}
                  </h4>
                </div>
                
                {/* QC Audit Status Badges */}
                {'status' in selectedItem ? (
                  selectedItem.status === 'Passed' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                      QC CERTIFIED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
                      REJECTED VOUCHER
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 animate-pulse">
                    AWAITING LAB AUDIT
                  </span>
                )}
              </div>

              {/* Lab Parameters Grid */}
              {'status' in selectedItem ? (
                // IF QualityInspection details
                <div className="space-y-4">
                  <div className="bg-emerald-50/20 border border-emerald-100/50 rounded-lg p-3 text-xs space-y-2">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                      <UserCheck size={14} />
                      <span>Auditor Verification</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-slate-600 font-semibold text-[11px]">
                      <div>Audited By: <span className="font-bold text-slate-800">{(selectedItem as QualityInspection).inspector}</span></div>
                      <div>Audit Date: <span className="font-bold text-slate-800">{(selectedItem as QualityInspection).date}</span></div>
                      <div className="col-span-2">Notes: <span className="italic text-slate-500 font-medium">"{(selectedItem as QualityInspection).notes}"</span></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Physical Dockage Parameters</span>
                    
                    {(selectedItem as QualityInspection).items.map((item, idx) => (
                      <div key={idx} className="border border-slate-100 rounded-lg p-3 space-y-2 text-xs">
                        <div className="flex justify-between items-center font-bold text-slate-800 border-b border-slate-50 pb-1">
                          <span>{getCommodityName(item.item)}</span>
                          <span className="text-emerald-600">Lab Score: {item.qualityScore}/100</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-500 font-medium">
                          <div className="flex justify-between">
                            <span>Moisture Percent:</span>
                            <span className="font-bold text-slate-700">{item.moisturePercent}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Purity Percent:</span>
                            <span className="font-bold text-slate-700">{item.purityPercent}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Damage Percent:</span>
                            <span className="font-bold text-slate-700">{item.damagePercent}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Foreign Material:</span>
                            <span className="font-bold text-slate-700">{item.foreignMaterialPercent}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Color/Texture:</span>
                            <span className="font-bold text-slate-700">{item.color}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Assigned Grade:</span>
                            <span className={`font-bold uppercase ${item.grade === 'A' ? 'text-emerald-600' : item.grade === 'B' ? 'text-indigo-500' : 'text-amber-600'}`}>{item.grade}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ✅ Next Steps Panel — only for Passed QC */}
                  {(selectedItem as QualityInspection).status === 'Passed' && (
                    <div className="border border-emerald-200 bg-emerald-50/30 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
                        <PackageCheck size={14} />
                        <span>Next Steps After QC Approval</span>
                      </div>

                      {/* Step 1: Warehouse Inward */}
                      {!inwardDone[(selectedItem as QualityInspection).id] ? (
                        <div className="space-y-2">
                          <p className="text-[10px] text-slate-500 font-medium">
                            Step 1 — Send accepted grain lot to warehouse bin storage.
                          </p>
                          <div className="flex gap-2">
                            <select
                              value={selectedBinId}
                              onChange={e => setSelectedBinId(e.target.value)}
                              className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-[11px] bg-white focus:outline-none"
                            >
                              <option value="">Auto-assign bin</option>
                              {db.bins?.map((b: any) => (
                                <option key={b.id} value={b.id}>{b.name} — {b.warehouseName || b.warehouseId}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleInwardAfterQc(selectedItem as QualityInspection)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 transition shrink-0 cursor-pointer"
                            >
                              <Warehouse size={12} />
                              Inward Stock
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-600 text-[11px] font-bold">
                          <CheckCircle2 size={14} />
                          <span>Stock inwarded to warehouse ✓</span>
                        </div>
                      )}

                      {/* Step 2: Create Purchase Invoice */}
                      <div className="border-t border-emerald-100 pt-3 space-y-1">
                        <p className="text-[10px] text-slate-500 font-medium">
                          Step 2 — Create the supplier purchase invoice for this lot.
                        </p>
                        <button
                          onClick={() => router.push('/procurement/invoices')}
                          className="w-full py-2 border border-emerald-500 text-emerald-600 hover:bg-emerald-50 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <span>Go to Purchase Invoices</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // IF GRN Details (Pending)
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700 flex gap-2">
                    <ShieldAlert size={16} className="shrink-0 text-amber-600 mt-0.5" />
                    <div className="space-y-0.5 font-semibold">
                      <span>Grain Lot Pending QC Certification</span>
                      <p className="leading-normal text-[10px] text-amber-600 font-medium">
                        This arrival has not undergone laboratory physical moisture checking. Process the laboratory QC certificate to update inventory ledger.
                      </p>
                    </div>
                  </div>

                  <div className="border border-slate-100 rounded-lg p-3 text-xs space-y-2 font-medium text-slate-500">
                    <div className="flex justify-between"><span>PO Reference:</span><span className="font-bold text-slate-700">{(selectedItem as GRN).poNo}</span></div>
                    <div className="flex justify-between"><span>Arrival Date:</span><span className="font-bold text-slate-700">{(selectedItem as GRN).arrivalDate}</span></div>
                    <div className="flex justify-between"><span>Vehicle Number:</span><span className="font-bold text-slate-700 uppercase">{(selectedItem as GRN).vehicleNo}</span></div>
                    <div className="flex justify-between"><span>Driver Name:</span><span className="font-bold text-slate-700">{(selectedItem as GRN).driverName}</span></div>
                    <div className="flex justify-between"><span>Transporter Link:</span><span className="font-bold text-slate-700">{(selectedItem as GRN).transporter}</span></div>
                  </div>

                  <button
                    onClick={() => openAuditModal(selectedItem as GRN)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition"
                  >
                    <FlaskConical size={14} />
                    <span>Run Laboratory Inspection</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-350 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <FlaskConical size={24} className="text-slate-350" />
              <span>Select an arrival record to examine laboratory moisture metrics or record quality audits.</span>
            </div>
          )}
        </div>
      </div>

      {/* QC Lab Audit Modal */}
      {isQcOpen && selectedItem && !('status' in selectedItem) && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Laboratory Quality Audit Certificate</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Test grain lot specifications for arrival {(selectedItem as GRN).grnNo}</p>
              </div>
              <button onClick={() => setIsQcOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <form onSubmit={handleSubmitQc} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Moisture (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    value={moisturePercent}
                    onChange={e => setMoisturePercent(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Purity (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    value={purityPercent}
                    onChange={e => setPurityPercent(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Assigned Grade</label>
                  <select
                    value={grade}
                    onChange={e => setGrade(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-medium focus:outline-none"
                  >
                    <option value="A">Grade A (Premium)</option>
                    <option value="B">Grade B (Standard)</option>
                    <option value="C">Grade C (Below Avg)</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Damage (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    value={damagePercent}
                    onChange={e => setDamagePercent(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Foreign Mat. (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    value={foreignMaterialPercent}
                    onChange={e => setForeignMaterialPercent(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Purity Score (0-100)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    value={qualityScore}
                    onChange={e => setQualityScore(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Color / Texture Description</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    placeholder="e.g. Bright Amber wheat..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Inspector</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 font-bold"
                    value="Laboratory Quality Control Dept."
                    disabled
                  />
                </div>
              </div>

              {/* Item discrepancy auditing */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Item Discrepancy Auditing</span>
                <div className="space-y-3">
                  {(selectedItem as GRN).items.map((item, idx) => {
                    const params = qcItemsRates[item.item] || { rejected: 0, damaged: 0 };
                    return (
                      <div key={idx} className="bg-white p-3 border border-slate-100 rounded-lg text-xs space-y-2">
                        <div className="flex justify-between items-center font-bold text-slate-800">
                          <span>{getCommodityName(item.item)}</span>
                          <span>Arrived: {item.receivedNow} {item.unit}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[8px] font-bold text-slate-400 block mb-0.5">Rejected Qty ({item.unit})</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full px-2 py-1 border border-slate-200 rounded text-[11px]"
                              value={params.rejected || ''}
                              onChange={e => handleQcItemChange(item.item, 'rejected', Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <label className="text-[8px] font-bold text-slate-400 block mb-0.5">Damaged Qty ({item.unit})</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full px-2 py-1 border border-slate-200 rounded text-[11px]"
                              value={params.damaged || ''}
                              onChange={e => handleQcItemChange(item.item, 'damaged', Number(e.target.value))}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQcOpen(false)}
                  className="flex-1 py-2 border border-slate-250 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer transition shadow-md shadow-emerald-600/10 text-center"
                >
                  Certify Lab Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
