'use client';

import React, { useState, useMemo } from 'react';
import { useErp } from '../../../context/ErpContext';
import { erpService } from '../../../services/erpService';
import { PurchaseOrder } from '../../../types/erp';
import DataTable from '../../../components/shared/DataTable';
import DocumentTimeline from '../../../components/shared/DocumentTimeline';
import ApprovalPanel from '../../../components/shared/ApprovalPanel';
import { ShoppingCart, Plus, Calendar, Landmark, Info, FilePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PurchaseOrdersPage() {
  const { db, refreshDb, currentUserRole, showToast } = useErp();
  const router = useRouter();

  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTimelineStep, setSelectedTimelineStep] = useState<string>('PO Created');

  const handleSelectPO = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setSelectedTimelineStep(getTimelineCurrentStep(po));
  };

  // Form states
  const [partyType, setPartyType] = useState<'supplier' | 'farmer'>('supplier');
  const [partyId, setPartyId] = useState('');
  const [commodityId, setCommodityId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [rate, setRate] = useState(0);
  const [transportCost, setTransportCost] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');

  // 1. Get parties and commodities
  const suppliers = db.suppliers;
  const farmers = db.farmers;
  const commodities = db.commodities;
  const warehouses = db.warehouses;

  const activeParties = partyType === 'supplier' ? suppliers : farmers;

  // Calculate totals for new PO
  const subtotal = quantity * rate;
  const charges = Number(transportCost) + Number(otherCharges);
  const gstAmt = Math.round((subtotal + charges) * 0.05); // 5% GST
  const grandTotal = subtotal + charges + gstAmt;

  const columns = [
    { header: 'PO Number', accessor: 'poNo' as keyof PurchaseOrder, sortable: true },
    { 
      header: 'Supplier/Farmer', 
      accessor: (row: PurchaseOrder) => {
        if (row.partyType === 'supplier') {
          return suppliers.find(s => s.id === row.partyId)?.name || 'Unknown Supplier';
        }
        return farmers.find(f => f.id === row.partyId)?.name || 'Unknown Farmer';
      },
      csvAccessor: (row: PurchaseOrder) => {
        if (row.partyType === 'supplier') {
          return suppliers.find(s => s.id === row.partyId)?.name || 'Unknown';
        }
        return farmers.find(f => f.id === row.partyId)?.name || 'Unknown';
      }
    },
    { 
      header: 'Commodity', 
      accessor: (row: PurchaseOrder) => commodities.find(c => c.id === row.commodityId)?.name || 'Unknown'
    },
    { header: 'Qty (MT)', accessor: 'quantity' as keyof PurchaseOrder },
    { 
      header: 'Total Value', 
      accessor: (row: PurchaseOrder) => `₹${row.total.toLocaleString()}`,
      csvAccessor: (row: PurchaseOrder) => String(row.total)
    },
    { header: 'Expected Delivery', accessor: 'expectedDelivery' as keyof PurchaseOrder },
    { 
      header: 'Status', 
      accessor: (row: PurchaseOrder) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.status === 'Received' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
          row.status === 'Partially Received' ? 'bg-blue-50 text-blue-600 border-blue-200' :
          row.status === 'Cancelled' ? 'bg-red-50 text-red-600 border-red-200' :
          row.status === 'Approved' ? 'bg-green-50 text-green-600 border-green-200' :
          'bg-amber-50 text-amber-600 border-amber-200 animate-pulse'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId || !commodityId || !warehouseId) {
      showToast('Please fill all mandatory fields', 'error');
      return;
    }

    const poNo = `PO/BR/2026-27/${String(db.purchaseOrders.length + 1).padStart(3, '0')}`;
    const id = `PO-${Date.now()}`;
    const date = new Date().toISOString().split('T')[0];

    const needsApproval = grandTotal >= 1000000;
    const status = needsApproval ? 'Pending Approval' : 'Approved';

    const newPO: PurchaseOrder = {
      id,
      poNo,
      date,
      partyType,
      partyId,
      commodityId,
      quantity,
      rate,
      transportCost,
      otherCharges,
      gstPercent: 5,
      total: grandTotal,
      expectedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days from now
      warehouseId,
      status,
      notes,
      approvalHistory: [
        { step: 'Creation', user: currentUserRole, action: 'Created', date }
      ]
    };

    erpService.purchaseOrders.create(newPO);
    refreshDb();
    setIsCreateOpen(false);
    handleSelectPO(newPO);
    showToast(`Purchase Order ${poNo} created successfully!`, 'success');
  };

  const handleApprove = (comment?: string) => {
    if (!selectedPO) return;
    erpService.approvePurchaseOrder(selectedPO.id, currentUserRole, comment);
    refreshDb();
    // Update selected details pane
    const updated = erpService.purchaseOrders.getById(selectedPO.id);
    if (updated) handleSelectPO(updated);
  };

  const handleReject = (comment?: string) => {
    if (!selectedPO) return;
    erpService.rejectPurchaseOrder(selectedPO.id, currentUserRole, comment);
    refreshDb();
    const updated = erpService.purchaseOrders.getById(selectedPO.id);
    if (updated) handleSelectPO(updated);
  };

  // Timeline definitions
  const timelineSteps = [
    { name: 'PO Created', description: 'Procurement initiated' },
    { name: 'GRN Created', description: 'Goods arrived at gate' },
    { name: 'Stock Added', description: 'Bin allocation done' }
  ];

  const getTimelineCurrentStep = (po: PurchaseOrder) => {
    // Check if GRN exists
    const grn = db.grns.find(g => g.poId === po.id);
    if (!grn) return 'PO Created';
    if (grn.inwardStatus === 'Completed') return 'Stock Added';
    return 'GRN Created';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Purchase Orders</h1>
          <p className="text-xs font-medium text-slate-400">Initiate purchases from farmers/suppliers and oversee approvals.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>New Purchase Order</span>
        </button>
      </div>

      {/* Main Grid: Data Table (Left) & PO Detail Drawer (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DataTable
            data={db.purchaseOrders}
            columns={columns}
            searchPlaceholder="Search PO number..."
            searchField="poNo"
            onRowClick={(row) => handleSelectPO(row)}
            exportFileName="purchase_orders_register"
          />
        </div>

        {/* PO details panel */}
        <div className="space-y-6">
          {selectedPO ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
              {/* Header Info */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{selectedPO.poNo}</h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">PO Date: {selectedPO.date}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-800 block">₹{selectedPO.total.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-400 block font-semibold">Includes 5% GST</span>
                </div>
              </div>

              {/* Document timeline map */}
              <DocumentTimeline
                steps={timelineSteps}
                currentStepName={getTimelineCurrentStep(selectedPO)}
                activeStepName={selectedTimelineStep}
                onStepClick={(stepName) => setSelectedTimelineStep(stepName)}
                isCompleted={selectedPO.status === 'Received'}
              />

              {/* Dynamic Section based on Selected Step */}
              {selectedTimelineStep === 'PO Created' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Step 1: Purchase Order Initiation
                  </div>
                  {/* Items Card */}
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-3.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Items & Pricing</span>
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-slate-800 block">
                          {commodities.find(c => c.id === selectedPO.commodityId)?.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Rate: ₹{(selectedPO.rate).toLocaleString()} / MT
                        </span>
                      </div>
                      <span className="font-bold text-slate-700">
                        {selectedPO.quantity} MT
                      </span>
                    </div>

                    <div className="border-t border-slate-100 pt-3 space-y-1.5 text-[11px] font-medium text-slate-500">
                      <div className="flex justify-between">
                        <span>Base Value:</span>
                        <span>₹{(selectedPO.quantity * selectedPO.rate).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Transport / Other charges:</span>
                        <span>₹{(selectedPO.transportCost + selectedPO.otherCharges).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>GST (5%):</span>
                        <span>₹{Math.round((selectedPO.quantity * selectedPO.rate + selectedPO.transportCost + selectedPO.otherCharges) * 0.05).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Details table */}
                  <div className="space-y-2 text-xs font-semibold text-slate-600">
                    <div className="flex justify-between border-b border-slate-50 pb-1.5">
                      <span className="text-slate-400">Supplier/Farmer:</span>
                      <span>
                        {selectedPO.partyType === 'supplier' 
                          ? suppliers.find(s => s.id === selectedPO.partyId)?.name 
                          : farmers.find(f => f.id === selectedPO.partyId)?.name}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-1.5">
                      <span className="text-slate-400">Inward Warehouse:</span>
                      <span>{warehouses.find(w => w.id === selectedPO.warehouseId)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expected Delivery:</span>
                      <span>{selectedPO.expectedDelivery}</span>
                    </div>
                  </div>

                  {/* Integrated Approval workflow panel */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <ApprovalPanel
                      documentId={selectedPO.id}
                      documentNo={selectedPO.poNo}
                      documentTotal={selectedPO.total}
                      approvalHistory={selectedPO.approvalHistory}
                      status={selectedPO.status}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                  </div>
                </div>
              )}

              {selectedTimelineStep === 'GRN Created' && (() => {
                const grn = db.grns.find(g => g.poId === selectedPO.id);
                return (
                  <div className="space-y-4 animate-fade-in">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider flex justify-between items-center">
                      <span>Step 2: Gate Entry Receipts</span>
                      {grn && (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[8px] font-bold">
                          Recorded
                        </span>
                      )}
                    </div>

                    {grn ? (
                      <div className="space-y-4">
                        <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-xs font-semibold text-slate-700 space-y-2">
                          <div className="flex justify-between border-b border-slate-100 pb-1.5">
                            <span className="text-slate-400">GRN Number:</span>
                            <span className="font-bold text-slate-800">{grn.grnNo}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-100 pb-1.5">
                            <span className="text-slate-400">Vehicle No:</span>
                            <span>{grn.vehicleNo}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-100 pb-1.5">
                            <span className="text-slate-400">Driver Name:</span>
                            <span>{grn.driverName}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-100 pb-1.5">
                            <span className="text-slate-400">Gate Weight:</span>
                            <span>{grn.weight} MT</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Arrived Date:</span>
                            <span>{grn.arrivalDate}</span>
                          </div>
                        </div>

                        {/* Quality Inspection results integrated here */}
                        {(() => {
                          const qi = db.qualityInspections.find(q => q.grnId === grn.id);
                          if (!qi) return null;
                          return (
                            <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 space-y-3">
                              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quality Audit Results</span>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                                  qi.status === 'Passed' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {qi.status}
                                </span>
                              </div>
                              <div className="text-xs font-semibold text-slate-700 space-y-2">
                                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                                  <span className="text-slate-400">Quality Score:</span>
                                  <span className="font-bold text-slate-800">{qi.qualityScore}/100</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                                  <span className="text-slate-400">Moisture Content:</span>
                                  <span>{qi.moisturePercent}%</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                                  <span className="text-slate-400">Assigned Grade:</span>
                                  <span className="font-mono bg-white px-1.5 py-0.5 border border-slate-200 rounded">{qi.grade}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Audit Date:</span>
                                  <span>{qi.date}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        <button
                          onClick={() => router.push(`/procurement/grn?search=${grn.grnNo}`)}
                          className="w-full py-2 bg-indigo-50 border border-indigo-150 text-indigo-600 hover:bg-indigo-100 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <Info size={14} />
                          <span>View GRN details</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-xs text-slate-400 font-medium text-center py-4">
                          No Goods Receipt Note (GRN) has been recorded yet for this Purchase Order.
                        </div>
                        {selectedPO.status === 'Approved' ? (
                          <button
                            onClick={() => router.push(`/procurement/grn?action=new&po=${selectedPO.id}`)}
                            className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-primary-600/10 cursor-pointer transition"
                          >
                            <FilePlus size={14} />
                            <span>Create Goods Receipt (GRN)</span>
                          </button>
                        ) : (
                          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700 text-center font-medium">
                            PO must be approved before you can create a Goods Receipt (GRN).
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {selectedTimelineStep === 'Stock Added' && (() => {
                const grn = db.grns.find(g => g.poId === selectedPO.id);
                const isInwarded = grn && grn.inwardStatus === 'Completed';
                const stockItem = grn ? db.stockItems.find(s => s.batchNo === grn.batchNo) : null;
                return (
                  <div className="space-y-4 animate-fade-in">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider flex justify-between items-center">
                      <span>Step 3: Warehouse Silo Allocation</span>
                      {isInwarded && (
                        <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-[8px] font-bold">
                          Allocated
                        </span>
                      )}
                    </div>

                    {isInwarded && stockItem ? (
                      <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-xs font-semibold text-slate-700 space-y-2">
                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-slate-400">Warehouse:</span>
                          <span>{warehouses.find(w => w.id === stockItem.warehouseId)?.name || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-slate-400">Rack / Silo Bin:</span>
                          <span>{stockItem.binId}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-slate-400">Batch Code:</span>
                          <span className="font-mono">{stockItem.batchNo}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Stock Qty:</span>
                          <span>{stockItem.quantity} {stockItem.unit}</span>
                        </div>
                      </div>
                    ) : grn ? (
                      <div className="space-y-4">
                        <div className="text-xs text-slate-400 font-medium text-center py-4">
                          Gate entry registered. Stock needs to be physically allocated to a warehouse bin.
                        </div>
                        <button
                          onClick={() => router.push(`/warehouse/inward?action=new&grn=${grn.id}`)}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition"
                        >
                          <Plus size={14} />
                          <span>Inward to Rack/Bin</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 font-medium text-center py-4">
                        Stock will be allocated to warehouse silo bins once gate entry is registered.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <ShoppingCart size={24} className="text-slate-300" />
              <span>Select a Purchase Order row to view details, approvals, and workflow timeline.</span>
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
                <h3 className="text-sm font-semibold text-slate-800">Create New Purchase Order</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Define purchase quantities, rates, and target warehouses.</p>
              </div>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreatePO} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    required
                  >
                    <option value="">Select Party</option>
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    required
                  >
                    <option value="">Select Commodity</option>
                    {commodities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Warehouse selector */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Destination Warehouse *</label>
                  <select
                    value={warehouseId}
                    onChange={e => setWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    required
                  >
                    <option value="">Select Warehouse</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Quantity */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Quantity (MT) *</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={rate}
                    onChange={e => setRate(Math.max(1, Number(e.target.value)))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Transport cost */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Estimated Transport Cost (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={transportCost}
                    onChange={e => setTransportCost(Math.max(0, Number(e.target.value)))}
                  />
                </div>

                {/* Other charges */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Other Surcharges / Loading (₹)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                    value={otherCharges}
                    onChange={e => setOtherCharges(Math.max(0, Number(e.target.value)))}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Additional Terms / Notes</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 min-h-[60px]"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. moisture content must be less than 12% at arrival."
                />
              </div>

              {/* Order total preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-center text-xs font-semibold">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block tracking-wider font-bold">Estimated PO Total</span>
                  <span className="text-sm font-bold text-slate-800">₹{grandTotal.toLocaleString()}</span>
                </div>
                <div className="text-right text-[10px] text-slate-400 leading-normal font-semibold">
                  <span>Base: ₹{subtotal.toLocaleString()}</span> <br />
                  <span>Freight/Loading: ₹{charges.toLocaleString()}</span> <br />
                  <span>GST (5%): ₹{gstAmt.toLocaleString()}</span>
                </div>
              </div>

              {/* Form submit */}
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
                  Create PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
