'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { GRN } from '../../../types/erp';
import DataTable from '../../../components/shared/DataTable';
import { FileText, Plus, Truck, FileCheck, HelpCircle } from 'lucide-react';

function GRNPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { db, refreshDb, showToast } = useErp();

  const [selectedGRN, setSelectedGRN] = useState<GRN | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [poId, setPoId] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [receivedQty, setReceivedQty] = useState(0);
  const [acceptedQty, setAcceptedQty] = useState(0);
  const [rejectedQty, setRejectedQty] = useState(0);
  const [weight, setWeight] = useState(0);
  const [batchNo, setBatchNo] = useState('');

  // Handle URL query parameters for conversion
  const poQueryParam = searchParams.get('po');
  useEffect(() => {
    if (poQueryParam) {
      setPoId(poQueryParam);
      const po = db.purchaseOrders.find(p => p.id === poQueryParam);
      if (po) {
        setReceivedQty(po.quantity);
        setAcceptedQty(po.quantity);
        setRejectedQty(0);
        setWeight(po.quantity);
        setBatchNo(`WHT-${po.partyId}-${new Date().toLocaleDateString('en-GB').replace(/\//g, '')}`);
        setIsCreateOpen(true);
      }
    }
  }, [poQueryParam, db.purchaseOrders]);

  const approvedPOs = db.purchaseOrders.filter(p => p.status === 'Approved' || p.status === 'Partially Received');
  const warehouses = db.warehouses;
  const commodities = db.commodities;
  const suppliers = db.suppliers;
  const farmers = db.farmers;

  const handleCreateGRN = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poId || !batchNo) {
      showToast('Please fill all mandatory fields', 'error');
      return;
    }

    const po = db.purchaseOrders.find(p => p.id === poId);
    if (!po) return;

    const grn = erpService.createGRNFromPO({
      poId: po.id,
      poNo: po.poNo,
      date: new Date().toISOString().split('T')[0],
      partyType: po.partyType,
      partyId: po.partyId,
      vehicleNo,
      driverName,
      arrivalDate: new Date().toISOString().split('T')[0],
      warehouseId: po.warehouseId,
      commodityId: po.commodityId,
      orderedQty: po.quantity,
      receivedQty,
      acceptedQty,
      rejectedQty,
      weight,
      batchNo
    });

    refreshDb();
    setIsCreateOpen(false);
    showToast(`GRN ${grn.grnNo} recorded. Quality Inspection alert raised!`, 'success');
    setSelectedGRN(grn);
  };

  const columns = [
    { header: 'GRN Number', accessor: 'grnNo' as keyof GRN, sortable: true },
    { header: 'PO Reference', accessor: 'poNo' as keyof GRN },
    { 
      header: 'Commodity', 
      accessor: (row: GRN) => commodities.find(c => c.id === row.commodityId)?.name || 'Unknown'
    },
    { header: 'Received Qty', accessor: (row: GRN) => `${row.receivedQty} MT` },
    { header: 'Accepted Qty', accessor: (row: GRN) => `${row.acceptedQty} MT` },
    { header: 'Vehicle No', accessor: 'vehicleNo' as keyof GRN },
    { 
      header: 'Q.C. Status', 
      accessor: (row: GRN) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.qualityStatus === 'Passed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
          row.qualityStatus === 'Rejected' ? 'bg-red-50 text-red-600 border-red-200' :
          row.qualityStatus === 'Partially Passed' ? 'bg-blue-50 text-blue-600 border-blue-200' :
          'bg-amber-50 text-amber-600 border-amber-200 animate-pulse'
        }`}>
          {row.qualityStatus}
        </span>
      )
    },
    { 
      header: 'Inwarding', 
      accessor: (row: GRN) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.inwardStatus === 'Completed' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'
        }`}>
          {row.inwardStatus}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Goods Receipt Notes (GRN)</h1>
          <p className="text-xs font-medium text-slate-400">Record arriving shipments, measure weight bridges, and inward stock to warehouse.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Record New GRN</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DataTable
            data={db.grns}
            columns={columns}
            searchPlaceholder="Search GRN or PO..."
            searchField="grnNo"
            onRowClick={(row) => setSelectedGRN(row)}
            exportFileName="goods_receipt_notes"
          />
        </div>

        {/* Selected GRN Info */}
        <div>
          {selectedGRN ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-800">{selectedGRN.grnNo}</h3>
                <span className="text-[10px] text-slate-400 block mt-0.5">PO Ref: {selectedGRN.poNo}</span>
              </div>

              {/* Tonnage Variance Alert */}
              {selectedGRN.orderedQty !== selectedGRN.receivedQty && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 space-y-1 font-medium">
                  <span className="font-bold flex items-center gap-1">
                    <Truck size={14} /> Inward Quantity Variance Found
                  </span>
                  <div className="grid grid-cols-2 text-[10px] leading-normal pt-1.5 gap-2 border-t border-blue-100">
                    <span>PO Ordered: {selectedGRN.orderedQty} MT</span>
                    <span>Gate Received: {selectedGRN.receivedQty} MT</span>
                    <span>Accepted: {selectedGRN.acceptedQty} MT</span>
                    <span className="text-red-600 font-bold">Rejected: {selectedGRN.rejectedQty} MT</span>
                  </div>
                </div>
              )}

              {/* Metadata details */}
              <div className="space-y-2.5 text-xs font-semibold text-slate-600">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Arrived Vehicle:</span>
                  <span>{selectedGRN.vehicleNo}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Driver Name:</span>
                  <span>{selectedGRN.driverName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-400">Allocated Batch:</span>
                  <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.2 rounded text-slate-700">{selectedGRN.batchNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Arrival Gate Date:</span>
                  <span>{selectedGRN.arrivalDate}</span>
                </div>
              </div>

              {/* Conversion Buttons */}
              <div className="space-y-2 pt-2">
                {selectedGRN.inwardStatus === 'Pending' ? (
                  <button
                    onClick={() => router.push(`/warehouse/inward?action=new&grn=${selectedGRN.id}`)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition"
                  >
                    <FileCheck size={14} />
                    <span>Inward to Rack/Bin</span>
                  </button>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center text-[10px] text-slate-400 font-semibold leading-normal">
                    ✅ GRN completed, quality certified, and inventory allocated in racks.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <FileText size={24} className="text-slate-300" />
              <span>Select a Goods Receipt Note row to examine gate details and proceed to quality checks.</span>
            </div>
          )}
        </div>
      </div>

      {/* Form Drawer */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Record Gate Entry (GRN)</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Capture incoming scale measurements and truck numbers.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateGRN} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Approved Purchase Order Reference *</label>
                <select
                  value={poId}
                  onChange={e => {
                    setPoId(e.target.value);
                    const po = db.purchaseOrders.find(p => p.id === e.target.value);
                    if (po) {
                      setReceivedQty(po.quantity);
                      setAcceptedQty(po.quantity);
                      setRejectedQty(0);
                      setWeight(po.quantity);
                      setBatchNo(`WHT-${po.partyId}-${new Date().toLocaleDateString('en-GB').replace(/\//g, '')}`);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                  required
                >
                  <option value="">Select Purchase Order</option>
                  {approvedPOs.map(po => (
                    <option key={po.id} value={po.id}>{po.poNo} - {po.partyType === 'supplier' ? suppliers.find(s => s.id === po.partyId)?.name : farmers.find(f => f.id === po.partyId)?.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Gate Truck Number</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={vehicleNo}
                    onChange={e => setVehicleNo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Driver Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Scale Weight (MT)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={weight}
                    onChange={e => setWeight(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Arrived Weight (MT)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={receivedQty}
                    onChange={e => {
                      setReceivedQty(Number(e.target.value));
                      setAcceptedQty(Number(e.target.value));
                      setRejectedQty(0);
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Rejected Quantity (MT)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={rejectedQty}
                    onChange={e => {
                      setRejectedQty(Number(e.target.value));
                      setAcceptedQty(Math.max(0, receivedQty - Number(e.target.value)));
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Batch Number Allocation *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 font-mono"
                    value={batchNo}
                    onChange={e => setBatchNo(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[10px] text-slate-500 font-medium">
                    Accepted: <span className="font-bold text-slate-700">{acceptedQty} MT</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-md shadow-primary-600/10 transition"
                >
                  Record GRN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GRNPage() {
  return (
    <React.Suspense fallback={<div className="p-4 text-xs font-semibold text-slate-400">Loading GRN...</div>}>
      <GRNPageContent />
    </React.Suspense>
  );
}
