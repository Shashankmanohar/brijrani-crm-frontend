'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useErp } from '../../../context/ErpContext';
import { erpService, getDb } from '../../../services/erpService';
import { GRN, GRNItem, PurchaseOrder, QualityInspection } from '../../../types/erp';
import DataTable from '../../../components/shared/DataTable';
import { FileText, Plus, Truck, FileCheck, ShieldAlert, Award, Compass, Scale, ClipboardCheck, Edit3, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';

export default function GRNPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { db, refreshDb, currentUserRole, showToast } = useErp();

  const [selectedGRN, setSelectedGRN] = useState<GRN | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isQcOpen, setIsQcOpen] = useState(false);
  const [qcFilter, setQcFilter] = useState<string>('All');

  // Form states for Header
  const [poId, setPoId] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [challanNo, setChallanNo] = useState('');
  const [challanDate, setChallanDate] = useState('');
  const [transporter, setTransporter] = useState('');
  const [remarks, setRemarks] = useState('');

  // Form states for Items list
  const [itemsList, setItemsList] = useState<GRNItem[]>([]);

  // Quality Inspection Form states
  const [moisturePercent, setMoisturePercent] = useState(11.5);
  const [grade, setGrade] = useState<'A' | 'B' | 'C' | 'Rejected'>('A');
  const [damagePercent, setDamagePercent] = useState(1);
  const [foreignMaterialPercent, setForeignMaterialPercent] = useState(0.5);
  const [color, setColor] = useState('Bright Golden');
  const [purityPercent, setPurityPercent] = useState(99.5);
  const [qualityScore, setQualityScore] = useState(92);
  const [qcNotes, setQcNotes] = useState('');
  const [qcItemsRates, setQcItemsRates] = useState<Record<string, { rejected: number; damaged: number }>>({});

  const approvedPOs = db.purchaseOrders.filter(p => p.status === 'Approved' || p.status === 'Partially Received');
  const warehouses = db.warehouses;
  const commodities = db.commodities;
  const suppliers = db.suppliers;
  const farmers = db.farmers;

  // Handle URL query parameters for PO-to-GRN conversion
  const poQueryParam = searchParams.get('po');
  useEffect(() => {
    if (poQueryParam) {
      const po = db.purchaseOrders.find(p => p.id === poQueryParam);
      if (po) {
        setPoId(po.id);
        loadPoItems(po);
        setIsCreateOpen(true);
      }
    }
  }, [poQueryParam, db.purchaseOrders]);

  // Load items from PO into GRN creation form
  const loadPoItems = (po: PurchaseOrder) => {
    const mappedItems: GRNItem[] = po.items.map(poItem => {
      // Find previously received quantity from existing Completion/Inwarded GRNs
      const previouslyReceived = db.grns
        .filter(g => g.poId === po.id && g.inwardStatus === 'Completed')
        .reduce((sum, g) => {
          const git = g.items?.find(gi => gi.item === poItem.item);
          return sum + (git ? git.acceptedQuantity : 0);
        }, 0);

      const pending = Math.max(0, poItem.quantity - previouslyReceived);

      return {
        item: poItem.item,
        orderedQty: poItem.quantity,
        previouslyReceived,
        receivedNow: pending,
        totalReceived: previouslyReceived + pending,
        pendingQuantity: 0,
        acceptedQuantity: pending,
        rejectedQuantity: 0,
        damagedQuantity: 0,
        unit: poItem.unit,
        batchNo: `BAT-${po.poNo.slice(-4)}-${Date.now().toString().slice(-3)}`
      };
    });
    setItemsList(mappedItems);
  };

  // Handle changing received quantity in creation form
  const handleReceivedQtyChange = (index: number, val: number) => {
    setItemsList(prev => {
      const updated = [...prev];
      const item = updated[index];
      const maxAllowed = item.orderedQty - item.previouslyReceived;
      const actualVal = Math.max(0, Math.min(maxAllowed + 10, val)); // Allow small buffer
      item.receivedNow = actualVal;
      item.acceptedQuantity = actualVal;
      item.totalReceived = item.previouslyReceived + actualVal;
      item.pendingQuantity = Math.max(0, item.orderedQty - item.totalReceived);
      return updated;
    });
  };

  const handleOpenEdit = () => {
    if (!selectedGRN) return;
    setPoId(selectedGRN.poId);
    setVehicleNo(selectedGRN.vehicleNo);
    setDriverName(selectedGRN.driverName || '');
    setChallanNo(selectedGRN.challanNo || '');
    setChallanDate(selectedGRN.challanDate || '');
    setTransporter(selectedGRN.transporter || '');
    setRemarks(selectedGRN.remarks || '');
    setItemsList(selectedGRN.items || []);
    setIsEditMode(true);
    setIsCreateOpen(true);
  };

  // Create GRN
  const handleCreateGRN = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poId || itemsList.length === 0) {
      showToast('Please select a valid PO and configure items', 'error');
      return;
    }

    if (isEditMode && selectedGRN) {
      const updatedGRN: GRN = {
        ...selectedGRN,
        poId,
        poNo: db.purchaseOrders.find(p => p.id === poId)?.poNo || selectedGRN.poNo,
        vehicleNo: vehicleNo.toUpperCase(),
        driverName,
        challanNo,
        challanDate: challanDate || new Date().toISOString().split('T')[0],
        transporter,
        remarks,
        items: itemsList,
        receivedQty: itemsList.reduce((sum, i) => sum + i.receivedNow, 0)
      };
      
      erpService.grns.update(updatedGRN);
      refreshDb();
      setIsCreateOpen(false);
      setIsEditMode(false);
      setVehicleNo('');
      setDriverName('');
      setChallanNo('');
      setTransporter('');
      setRemarks('');
      setSelectedGRN(updatedGRN);
      showToast(`GRN ${selectedGRN.grnNo} updated successfully!`, 'success');
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
      vehicleNo: vehicleNo.toUpperCase(),
      driverName,
      arrivalDate: new Date().toISOString().split('T')[0],
      warehouseId: po.warehouseId,
      challanNo,
      challanDate: challanDate || new Date().toISOString().split('T')[0],
      transporter,
      remarks,
      items: itemsList
    });

    refreshDb();
    setIsCreateOpen(false);
    setVehicleNo('');
    setDriverName('');
    setChallanNo('');
    setTransporter('');
    setRemarks('');
    setSelectedGRN(grn);
    showToast(`GRN ${grn.grnNo} recorded. Status: Pending Quality Inspection`, 'success');
  };

  // Start Quality Inspection Modal
  const handleOpenQc = () => {
    if (!selectedGRN) return;
    
    // Initialize QC item parameters record
    const qcInit: Record<string, { rejected: number; damaged: number }> = {};
    selectedGRN.items.forEach(item => {
      qcInit[item.item] = { rejected: 0, damaged: 0 };
    });
    setQcItemsRates(qcInit);
    setIsQcOpen(true);
  };

  const handleQcItemChange = (itemCode: string, field: 'rejected' | 'damaged', val: number) => {
    setQcItemsRates(prev => ({
      ...prev,
      [itemCode]: {
        ...prev[itemCode],
        [field]: Math.max(0, val)
      }
    }));
  };

  // Submit Quality Inspection
  const handleSubmitQc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGRN) return;

    const qcItems = selectedGRN.items.map(item => {
      const qcParams = qcItemsRates[item.item] || { rejected: 0, damaged: 0 };
      const status = grade === 'Rejected' ? 'Rejected' as const : 'Passed' as const;
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
        status,
        rejectedQuantity: qcParams.rejected,
        damagedQuantity: qcParams.damaged,
        remarks: qcNotes
      };
    });

    const overallStatus = grade === 'Rejected' ? 'Rejected' as const : 'Passed' as const;

    erpService.submitQualityInspection({
      grnId: selectedGRN.id,
      grnNo: selectedGRN.grnNo,
      inspector: currentUserRole || 'Quality Auditor',
      status: overallStatus,
      notes: qcNotes,
      items: qcItems,
      // Fallbacks
      commodityId: selectedGRN.commodityId,
      batchNo: selectedGRN.batchNo,
      quantity: selectedGRN.receivedQty,
      moisturePercent,
      grade,
      weight: selectedGRN.weight,
      color,
      foreignMaterialPercent,
      damagePercent,
      qualityScore
    });

    refreshDb();
    setIsQcOpen(false);
    const updated = db.grns.find(g => g.id === selectedGRN.id);
    if (updated) setSelectedGRN(updated);
    showToast(`Quality inspection voucher created. GRN status updated.`, 'success');
  };

  const handleDownloadPDF = (grn: GRN) => {
    const doc = new jsPDF();

    // Fonts and Branding
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text("BRIJRANI AGRO FOODS LTD", 14, 20);

    // Subtitle
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text("Patna Bypass Road, Didarganj, Patna, Bihar, 800008", 14, 25);
    doc.text("Email: logistics@brijranierp.com | Phone: +91 9988776655", 14, 29);

    // Decorative line
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 33, 196, 33);

    // Document Title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text("GOODS RECEIPT NOTE (GATE ENTRY SLIP)", 14, 42);

    // Metadata
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`GRN Number:     ${grn.grnNo}`, 14, 50);
    doc.text(`Entry Date:     ${grn.date}`, 14, 56);
    doc.text(`Arrival Date:   ${grn.arrivalDate}`, 14, 62);
    doc.text(`PO Reference:   ${grn.poNo}`, 14, 68);
    doc.text(`Quality Status: ${grn.qualityStatus}`, 14, 74);
    doc.text(`Inward Status: ${grn.inwardStatus}`, 14, 80);

    const vendorName = grn.partyType === 'supplier'
      ? suppliers.find(s => s.id === grn.partyId)?.name
      : farmers.find(f => f.id === grn.partyId)?.name;
    const vendorGSTIN = grn.partyType === 'supplier'
      ? suppliers.find(s => s.id === grn.partyId)?.gstin
      : 'Farmer (URP)';

    // Vendor Block
    doc.setFont("Helvetica", "bold");
    doc.text("VENDOR DETAILS:", 14, 92);
    doc.setFont("Helvetica", "normal");
    doc.text(vendorName || 'Unknown Vendor', 14, 98);
    doc.text(`GSTIN: ${vendorGSTIN || 'N/A'}`, 14, 104);

    const warehouseName = warehouses.find(w => w.id === grn.warehouseId)?.name || 'N/A';
    doc.setFont("Helvetica", "bold");
    doc.text("RECEIVING WAREHOUSE:", 110, 92);
    doc.setFont("Helvetica", "normal");
    doc.text(warehouseName, 110, 98);
    doc.text(`Vehicle No: ${grn.vehicleNo.toUpperCase()}`, 110, 104);

    // Transport details
    doc.setFont("Helvetica", "bold");
    doc.text("TRANSPORTATION & CHALLAN DETAILS:", 14, 116);
    doc.setFont("Helvetica", "normal");
    doc.text(`Driver Name: ${grn.driverName || 'N/A'}`, 14, 122);
    doc.text(`Transporter: ${grn.transporter || 'Self/Direct'}`, 14, 128);
    doc.text(`Challan No:  ${grn.challanNo || 'N/A'}`, 110, 122);
    doc.text(`Challan Date: ${grn.challanDate || 'N/A'}`, 110, 128);

    // Items table header
    const tableTop = 138;
    doc.setFillColor(248, 250, 252);
    doc.rect(14, tableTop, 182, 8, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Received Commodity Item", 16, tableTop + 5.5);
    doc.text("PO Qty", 70, tableTop + 5.5, { align: "right" });
    doc.text("Recv Now", 95, tableTop + 5.5, { align: "right" });
    doc.text("Accepted", 120, tableTop + 5.5, { align: "right" });
    doc.text("Rejected", 145, tableTop + 5.5, { align: "right" });
    doc.text("Batch Number", 194, tableTop + 5.5, { align: "right" });

    // Table divider
    doc.setDrawColor(226, 232, 240);
    doc.line(14, tableTop + 8, 196, tableTop + 8);

    // Item rows
    let itemY = tableTop + 14;
    (grn.items || []).forEach(item => {
      const commName = commodities.find(c => c.id === item.item)?.name || 'Commodity';
      doc.setFont("Helvetica", "bold");
      doc.text(commName, 16, itemY);
      doc.setFont("Helvetica", "normal");
      doc.text(`${item.orderedQty} ${item.unit}`, 70, itemY, { align: "right" });
      doc.text(`${item.receivedNow} ${item.unit}`, 95, itemY, { align: "right" });
      doc.text(`${item.acceptedQuantity} ${item.unit}`, 120, itemY, { align: "right" });
      doc.text(`${item.rejectedQuantity} ${item.unit}`, 145, itemY, { align: "right" });
      doc.text(`${item.batchNo || 'N/A'}`, 194, itemY, { align: "right" });
      itemY += 8;
    });

    doc.line(14, itemY - 3, 196, itemY - 3);

    // Weight and remarks
    let remarksY = itemY + 8;
    if (grn.weight) {
      doc.setFont("Helvetica", "bold");
      doc.text(`Weighbridge Gross Weight: ${grn.weight} MT`, 14, remarksY);
      remarksY += 6;
    }
    if (grn.remarks) {
      doc.setFont("Helvetica", "normal");
      doc.text(`Remarks: ${grn.remarks}`, 14, remarksY);
      remarksY += 6;
    }

    // Signatures
    let sigY = remarksY + 30;
    if (sigY > 260) {
      doc.addPage();
      sigY = 40;
    }
    doc.setFont("Helvetica", "bold");
    doc.text("Security Officer / Gate Entry Keeper", 14, sigY);
    doc.text("Receiving Officer (Warehouse)", 125, sigY);
    doc.line(14, sigY + 10, 70, sigY + 10);
    doc.line(125, sigY + 10, 185, sigY + 10);

    // Footer
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("This is an official gate receipt slip generated by BrijRani Agro Foods Ltd. logistics system.", 14, 280);

    doc.save(`gate_receipt_grn_${grn.grnNo.replace(/\//g, '_')}.pdf`);
    showToast(`GRN gate entry slip PDF downloaded successfully!`, 'success');
  };

  const columns = [
    { header: 'GRN Number', accessor: 'grnNo' as keyof GRN, sortable: true },
    { header: 'PO Reference', accessor: 'poNo' as keyof GRN },
    { 
      header: 'Supplier/Farmer', 
      accessor: (row: GRN) => {
        if (row.partyType === 'supplier') {
          return suppliers.find(s => s.id === row.partyId)?.name || 'Unknown';
        }
        return farmers.find(f => f.id === row.partyId)?.name || 'Unknown';
      }
    },
    { header: 'Gate Date', accessor: 'date' as keyof GRN },
    { header: 'Vehicle No', accessor: 'vehicleNo' as keyof GRN },
    { 
      header: 'QC Auditing', 
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
      header: 'Inward Status', 
      accessor: (row: GRN) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          row.inwardStatus === 'Completed' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'
        }`}>
          {row.inwardStatus}
        </span>
      )
    }
  ];

  const grnFilterTabs = [
    { label: 'All', value: 'All' },
    { label: 'Pending QC', value: 'Pending' },
    { label: 'Passed', value: 'Passed' },
    { label: 'Rejected', value: 'Rejected' },
    { label: 'Inward Done', value: 'Inward Done' },
  ];

  const filteredGRNs = useMemo(() => {
    if (qcFilter === 'All') return db.grns;
    if (qcFilter === 'Inward Done') return db.grns.filter(g => g.inwardStatus === 'Completed');
    return db.grns.filter(g => g.qualityStatus === qcFilter);
  }, [db.grns, qcFilter]);

  if (!['Super Admin', 'Purchase Manager', 'Warehouse Staff'].includes(currentUserRole)) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-md mx-auto mt-20 space-y-4 animate-fade-in">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto text-lg font-bold">✕</div>
        <h2 className="text-sm font-bold text-slate-800">Access Denied</h2>
        <p className="text-xs text-slate-400 font-semibold leading-normal">Your account role ({currentUserRole}) does not have permission to access the Goods Receipt module.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Goods Receipt Slips (GRN)</h1>
          <p className="text-xs font-medium text-slate-400">Record gate arrivals, trigger laboratory quality inspection logs, and inward materials into stocks.</p>
        </div>
        <button
          onClick={() => {
            setItemsList([]);
            setVehicleNo('');
            setDriverName('');
            setChallanNo('');
            setTransporter('');
            setRemarks('');
            setPoId('');
            setIsEditMode(false);
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Record Cargo Entry (GRN)</span>
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-3">
          {/* QC Filter Tabs */}
          <div className="bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-1 flex-wrap">
            {grnFilterTabs.map(tab => {
              const count = tab.value === 'All'
                ? db.grns.length
                : tab.value === 'Inward Done'
                ? db.grns.filter(g => g.inwardStatus === 'Completed').length
                : db.grns.filter(g => g.qualityStatus === tab.value).length;
              const isActive = qcFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setQcFilter(tab.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-slate-800 border border-slate-200 shadow-sm font-bold'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                  {count > 0 && !isActive && (
                    <span className="ml-1 text-[10px] text-slate-400">({count})</span>
                  )}
                </button>
              );
            })}
          </div>

          <DataTable
            data={filteredGRNs}
            columns={columns}
            searchPlaceholder="Search GRN or PO..."
            searchField="grnNo"
            onRowClick={(row) => setSelectedGRN(row)}
            exportFileName="goods_receipt_notes_list"
          />
        </div>

        {/* Selected GRN Details */}
        <div>
          {selectedGRN ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 animate-fade-in">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{selectedGRN.grnNo}</h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">PO Ref: {selectedGRN.poNo}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                  selectedGRN.qualityStatus === 'Passed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                  selectedGRN.qualityStatus === 'Rejected' ? 'bg-red-50 text-red-600 border-red-200' :
                  'bg-amber-50 text-amber-600 border-amber-200 animate-pulse'
                }`}>
                  {selectedGRN.qualityStatus.toUpperCase()}
                </span>
              </div>

              {/* Gate Entry details */}
              <div className="space-y-2.5 text-xs font-semibold text-slate-600 border-b border-slate-100 pb-4">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold flex items-center gap-1"><Truck size={12} /> Vehicle Number:</span>
                  <span className="text-slate-800">{selectedGRN.vehicleNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Driver Name:</span>
                  <span>{selectedGRN.driverName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Transporter:</span>
                  <span>{selectedGRN.transporter || 'Self Delivery'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Challan Reference:</span>
                  <span>{selectedGRN.challanNo} ({selectedGRN.challanDate})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold flex items-center gap-1"><Scale size={12} /> Target Warehouse:</span>
                  <span className="text-primary-600 font-bold">{warehouses.find(w => w.id === selectedGRN.warehouseId)?.name || 'N/A'}</span>
                </div>
              </div>

              {/* Item Details Grid */}
              <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Delivered Quantities</span>
                <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                  {selectedGRN.items?.map((item, idx) => {
                    const hasDiscrepancy = item.rejectedQuantity > 0 || item.damagedQuantity > 0;
                    return (
                      <div key={idx} className="text-xs border-b border-slate-100 pb-2 last:border-0 last:pb-0 space-y-1">
                        <div className="flex justify-between items-center font-bold text-slate-800">
                          <span>{commodities.find(c => c.id === item.item)?.name || item.item}</span>
                          <span>Ordered: {item.orderedQty} {item.unit}</span>
                        </div>
                        <div className="grid grid-cols-3 text-[10px] text-slate-500 font-medium leading-tight">
                          <span>Received: {item.receivedNow}</span>
                          <span className="text-green-600 font-bold">Passed QC: {item.acceptedQuantity}</span>
                          <span className="text-red-500">Rejected: {item.rejectedQuantity}</span>
                        </div>
                        {hasDiscrepancy && (
                          <div className="text-[9px] bg-red-50 border border-red-100 rounded px-1.5 py-0.5 text-red-600 font-medium">
                            ⚠️ Damaged quantity: {item.damagedQuantity} {item.unit}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* QC Details card */}
              {selectedGRN.qualityStatus !== 'Pending' && (
                <div className="border border-emerald-100 bg-emerald-50/30 rounded-xl p-4 space-y-2 text-xs font-semibold text-slate-600">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block flex items-center gap-1">
                    <Award size={13} /> Lab Inspection Certificate
                  </span>
                  {(() => {
                    const qi = db.qualityInspections.find(q => q.grnId === selectedGRN.id);
                    if (!qi) return <span className="text-slate-400 font-medium italic text-[11px]">Inspection log not found</span>;
                    return (
                      <div className="grid grid-cols-2 gap-2 text-[11px] leading-tight">
                        <div>Moisture: <span className="font-bold text-slate-800">{qi.moisturePercent}%</span></div>
                        <div>Purity: <span className="font-bold text-slate-800">{qi.items?.[0]?.purityPercent ?? 0}%</span></div>
                        <div>Damage: <span className="font-bold text-slate-800">{qi.damagePercent}%</span></div>
                        <div>Score: <span className="font-bold text-emerald-600">{qi.qualityScore} / 100</span></div>
                        <div className="col-span-2 border-t border-emerald-100/50 pt-1.5 mt-1 font-bold">
                          Assigned Grade: <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded">Grade {qi.grade}</span>
                        </div>
                        {qi.notes && (
                          <div className="col-span-2 text-[10px] text-slate-400 font-sans italic pt-1">
                            "{qi.notes}"
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-2">
                {selectedGRN.qualityStatus === 'Pending' && (
                  <button
                    onClick={handleOpenEdit}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer transition mb-2"
                  >
                    <Edit3 size={14} />
                    <span>Edit Gate Receipt (GRN)</span>
                  </button>
                )}
                {selectedGRN.qualityStatus === 'Pending' && (
                  <button
                    onClick={handleOpenQc}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/10 cursor-pointer transition"
                  >
                    <ClipboardCheck size={14} />
                    <span>Process Quality Control (QC)</span>
                  </button>
                )}

                {selectedGRN.qualityStatus !== 'Pending' && selectedGRN.inwardStatus === 'Pending' && (
                  <button
                    onClick={() => {
                      erpService.inwardStock(selectedGRN.id, 'N/A');
                      refreshDb();
                      const updated = getDb().grns.find((g: GRN) => g.id === selectedGRN.id);
                      if (updated) setSelectedGRN(updated);
                      showToast('Cargo Inward slip marked as complete and stock added successfully!', 'success');
                    }}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition"
                  >
                    <FileCheck size={14} />
                    <span>Complete Inward Slip & Add Stock</span>
                  </button>
                )}

                {selectedGRN.inwardStatus === 'Completed' && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center text-[10px] text-slate-400 font-semibold leading-normal mb-2">
                    ✅ Material complete. Quality certified, and stock updated in warehouse.
                  </div>
                )}

                <button
                  onClick={() => handleDownloadPDF(selectedGRN)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Download size={14} className="text-red-500" />
                  <span>Download GRN Slip PDF</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400 font-semibold h-[250px] flex flex-col items-center justify-center gap-2">
              <FileText size={24} className="text-slate-300" />
              <span>Select an Inward Slip row to verify scale weight bridge measurements, inspect parameters, and inward stock.</span>
            </div>
          )}
        </div>
      </div>

      {/* Creation Modal form */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{isEditMode ? `Edit Gate Receipt (GRN): ${selectedGRN?.grnNo}` : 'Record Gate Entry slip (GRN)'}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{isEditMode ? 'Modify incoming cargo gate measurements or challan numbers.' : 'Capture incoming scale measurements and supplier delivery challans at the warehouse gate.'}</p>
              </div>
              <button onClick={() => { setIsCreateOpen(false); setIsEditMode(false); }} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <form onSubmit={handleCreateGRN} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Approved Purchase Order Reference *</label>
                <select
                  value={poId}
                  onChange={e => {
                    setPoId(e.target.value);
                    const po = db.purchaseOrders.find(p => p.id === e.target.value);
                    if (po) {
                      loadPoItems(po);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                  required
                >
                  <option value="">Select Purchase Order</option>
                  {approvedPOs.map(po => {
                    const partyName = po.partyType === 'supplier'
                      ? suppliers.find(s => s.id === po.partyId)?.name
                      : farmers.find(f => f.id === po.partyId)?.name;
                    return (
                      <option key={po.id} value={po.id}>{po.poNo} - {partyName} (Value: ₹{(po.total ?? 0).toLocaleString()})</option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Gate Truck Plate Number *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={vehicleNo}
                    onChange={e => setVehicleNo(e.target.value)}
                    placeholder="e.g. BR-01-AB-1234"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Driver Name *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                    placeholder="e.g. Satish Yadav"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Supplier Challan No *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={challanNo}
                    onChange={e => setChallanNo(e.target.value)}
                    placeholder="Challan reference..."
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Challan Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={challanDate}
                    onChange={e => setChallanDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Transporter Agency</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                    value={transporter}
                    onChange={e => setTransporter(e.target.value)}
                    placeholder="Mithila Logistics..."
                  />
                </div>
              </div>

              {/* Items logging */}
              {itemsList.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Quantities Arrived at Weight bridge</span>
                  <div className="space-y-3">
                    {itemsList.map((item, idx) => {
                      const comm = commodities.find(c => c.id === item.item);
                      const pending = item.orderedQty - item.previouslyReceived;
                      return (
                        <div key={idx} className="flex gap-4 items-center bg-white p-3 border border-slate-100 rounded-lg text-xs">
                          <div className="flex-1">
                            <span className="font-bold text-slate-800 block">{comm?.name || 'Commodity'}</span>
                            <span className="text-[10px] text-slate-400 block font-semibold">
                              PO Ordered: {item.orderedQty} {item.unit} | Pending: {pending} {item.unit}
                            </span>
                          </div>
                          <div className="w-32">
                            <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Arrived Quantity *</label>
                            <input
                              type="number"
                              className="w-full px-2.5 py-1 border border-slate-200 rounded-lg text-xs font-semibold"
                              value={item.receivedNow || ''}
                              onChange={e => handleReceivedQtyChange(idx, Number(e.target.value))}
                              required
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Form submit */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsCreateOpen(false); setIsEditMode(false); }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-md shadow-primary-600/10 transition"
                >
                  Record Gate Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Laboratory Quality Inspection Modal Form */}
      {isQcOpen && selectedGRN && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Laboratory Quality Audit Certificate</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Test physical moisture, foreign material percentage, and register accepted quantities for {selectedGRN.grnNo}.</p>
              </div>
              <button onClick={() => setIsQcOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            <form onSubmit={handleSubmitQc} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Moisture Percent (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    value={moisturePercent}
                    onChange={e => setMoisturePercent(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Purity Percent (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    value={purityPercent}
                    onChange={e => setPurityPercent(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Overall Assigned Grade</label>
                  <select
                    value={grade}
                    onChange={e => setGrade(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Damage Percent (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    value={damagePercent}
                    onChange={e => setDamagePercent(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Foreign Material (%)</label>
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
                    placeholder="e.g. Golden Amber, Slightly Humid..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Inspector Sign</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 font-bold"
                    value="Laboratory Quality Control Dept."
                    disabled
                  />
                </div>
              </div>

              {/* Inward Discrepancy parameters */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Item Discrepancy Auditing</span>
                
                <div className="space-y-3">
                  {selectedGRN.items.map((item, idx) => {
                    const params = qcItemsRates[item.item] || { rejected: 0, damaged: 0 };
                    const comm = commodities.find(c => c.id === item.item);
                    const acceptedAmt = Math.max(0, item.receivedNow - params.rejected - params.damaged);

                    return (
                      <div key={idx} className="bg-white p-3 border border-slate-100 rounded-lg text-xs space-y-2">
                        <div className="flex justify-between items-center font-bold text-slate-800">
                          <span>{comm?.name || item.item}</span>
                          <span>Arrived: {item.receivedNow} {item.unit}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
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
                          <div className="flex flex-col justify-end text-right">
                            <span className="text-[8px] font-bold text-slate-400 block mb-0.5">Final Accepted</span>
                            <span className="font-extrabold text-emerald-600">{acceptedAmt} {item.unit}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">QC Remarks / Notes</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  value={qcNotes}
                  onChange={e => setQcNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional inspection results..."
                />
              </div>

              {/* Form submit */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQcOpen(false)}
                  className="px-4 py-2 border border-slate-250 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-md shadow-primary-600/10 transition"
                >
                  Approve QC Inspection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
