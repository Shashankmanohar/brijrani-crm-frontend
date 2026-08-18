'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useErp } from '../../context/ErpContext';
import { erpService } from '../../services/erpService';
import DataTable from '../../components/shared/DataTable';
import { Plus, Database, UserCheck, ShieldAlert, CheckCircle, Trash2 } from 'lucide-react';

function MastersHubPageContent() {
  const searchParams = useSearchParams();
  const { db, refreshDb, showToast } = useErp();

  const tabQuery = searchParams.get('tab') as 'customers' | 'suppliers' | 'farmers' | 'commodities' | 'warehouses' | 'bins' | 'vehicles' | 'drivers';
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers' | 'farmers' | 'commodities' | 'warehouses' | 'bins' | 'vehicles' | 'drivers'>(tabQuery || 'customers');
  
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Sync activeTab state with URL tab changes (essential for redirects like Bins & Racks)
  useEffect(() => {
    if (tabQuery) {
      setActiveTab(tabQuery);
    }
  }, [tabQuery]);

  // Bin States
  const [binCode, setBinCode] = useState('');
  const [binWarehouseId, setBinWarehouseId] = useState('');
  const [binAllowedCommodityId, setBinAllowedCommodityId] = useState('');

  const handleDelete = (tab: typeof activeTab, id: string, displayName: string) => {
    if (confirm(`Are you sure you want to delete "${displayName}"?`)) {
      erpService[tab].delete(id);
      showToast(`Entry "${displayName}" deleted`, 'success');
      refreshDb();
    }
  };

  // New Entity Form States
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('Bihar');
  const [gstin, setGstin] = useState('');

  // Commodity States
  const [category, setCategory] = useState<'Grains' | 'Oilseeds' | 'Pulses' | 'Other'>('Grains');
  const [unit, setUnit] = useState<'MT' | 'Qtl' | 'Kg'>('MT');
  const [hsn, setHsn] = useState('');
  const [defaultGst, setDefaultGst] = useState(5);
  const [cost, setCost] = useState(0);
  const [market, setMarket] = useState(0);
  const [target, setTarget] = useState(0);
  const [minStock, setMinStock] = useState(20);

  // Warehouse States
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState(500);

  // Vehicle States
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleType, setVehicleType] = useState('Tata 1613 Truck');
  const [driverId, setDriverId] = useState('');

  // Driver States
  const [license, setLicense] = useState('');

  const handleAddMaster = (e: React.FormEvent) => {
    e.preventDefault();
    const dateStr = new Date().toISOString().split('T')[0];

    if (activeTab === 'customers') {
      if (!name || !gstin) return;
      erpService.customers.create({
        id: `CUS-${Date.now()}`,
        name, phone, email, address, state, gstin,
        balance: 0, status: 'Active'
      });
      showToast(`Customer ${name} registered`, 'success');
    } 
    else if (activeTab === 'suppliers') {
      if (!name || !gstin) return;
      erpService.suppliers.create({
        id: `SUP-${Date.now()}`,
        name, phone, email, address, state, gstin,
        balance: 0, status: 'Active'
      });
      showToast(`Supplier ${name} registered`, 'success');
    } 
    else if (activeTab === 'farmers') {
      if (!name) return;
      erpService.farmers.create({
        id: `FRM-${Date.now()}`,
        name, phone, email, address, state, gstin: gstin || undefined,
        balance: 0, status: 'Active'
      });
      showToast(`Farmer ${name} registered`, 'success');
    }
    else if (activeTab === 'commodities') {
      if (!name) return;
      const generatedSku = `CMD-${Math.floor(100000 + Math.random() * 900000)}`;
      erpService.commodities.create({
        id: `CMD-${Date.now()}`,
        name,
        sku: generatedSku,
        category, unit, hsn, defaultGst,
        purchaseCost: Number(cost),
        currentMarketPrice: Number(market),
        targetPrice: Number(target),
        stockQty: 0, reservedQty: 0,
        minStockLevel: Number(minStock)
      });
      showToast(`Commodity ${name} added`, 'success');
    }
    else if (activeTab === 'warehouses') {
      if (!name || !location) return;
      erpService.warehouses.create({
        id: `WH-${Date.now()}`,
        name, location, capacityMT: Number(capacity),
        usedCapacityMT: 0, status: 'Active'
      });
      showToast(`Warehouse facility ${name} added`, 'success');
    }
    else if (activeTab === 'bins') {
      if (!name || !binCode || !binWarehouseId || !binAllowedCommodityId) {
        showToast('Please fill all mandatory fields', 'error');
        return;
      }
      erpService.bins.create({
        id: `BIN-${Date.now()}`,
        name,
        binCode,
        warehouseId: binWarehouseId,
        allowedCommodityId: binAllowedCommodityId,
        capacityMT: Number(capacity),
        occupiedMT: 0,
        rackId: 'RACK-001'
      });
      showToast(`Silo Bin ${name} added`, 'success');
      // Reset Bin Form
      setBinCode('');
      setBinWarehouseId('');
      setBinAllowedCommodityId('');
    }
    else if (activeTab === 'vehicles') {
      if (!vehicleNo) return;
      erpService.vehicles.create({
        id: `VEH-${Date.now()}`,
        number: vehicleNo,
        type: vehicleType,
        capacityMT: Number(capacity),
        driverId: driverId || undefined,
        status: 'Available'
      });
      showToast(`Vehicle ${vehicleNo} registered`, 'success');
    }
    else if (activeTab === 'drivers') {
      if (!name || !license) return;
      erpService.drivers.create({
        id: `DRV-${Date.now()}`,
        name, phone, licenseNumber: license,
        status: 'Active'
      });
      showToast(`Driver ${name} registered`, 'success');
    }

    refreshDb();
    setIsAddOpen(false);
    // Reset Form
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setGstin('');
    setVehicleNo('');
    setLicense('');
    setState('Bihar');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Master Registries</h1>
          <p className="text-xs font-medium text-slate-400">Configure base directories for partners, commodities, fleet logistics, and warehouses.</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
        >
          <Plus size={14} />
          <span>Register New Entry</span>
        </button>
      </div>

      {/* Tabs list */}
      <div className="flex flex-wrap border-b border-slate-200 gap-1">
        {[
          { key: 'customers', label: 'Customers' },
          { key: 'suppliers', label: 'Suppliers' },
          { key: 'farmers', label: 'Farmers' },
          { key: 'commodities', label: 'Commodities' },
          { key: 'warehouses', label: 'Warehouses' },
          { key: 'bins', label: 'Bins & Racks' },
          { key: 'vehicles', label: 'Vehicles' },
          { key: 'drivers', label: 'Drivers' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === t.key 
                ? 'border-primary-600 text-primary-600' 
                : 'border-transparent text-slate-400 hover:text-slate-655'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table registers */}
      <div className="space-y-4">
        {activeTab === 'customers' && (
          <DataTable
            data={db.customers}
            columns={[
              { header: 'Customer Name', accessor: 'name', sortable: true },
              { header: 'GSTIN ID', accessor: 'gstin' },
              { header: 'Phone', accessor: 'phone' },
              { header: 'State Location', accessor: 'state' },
              { header: 'Receivables due', accessor: (row: any) => `₹${row.balance.toLocaleString()}` },
              { header: 'Status', accessor: 'status' },
              {
                header: 'Actions',
                accessor: (row: any) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete('customers', row.id, row.name);
                    }}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                    title="Delete customer"
                  >
                    <Trash2 size={14} />
                  </button>
                ),
                className: 'w-20 text-center'
              }
            ]}
            searchPlaceholder="Search customer name..."
            searchField="name"
            exportFileName="customers_master"
          />
        )}

        {activeTab === 'suppliers' && (
          <DataTable
            data={db.suppliers}
            columns={[
              { header: 'Supplier Name', accessor: 'name', sortable: true },
              { header: 'GSTIN ID', accessor: 'gstin' },
              { header: 'Phone', accessor: 'phone' },
              { header: 'State Location', accessor: 'state' },
              { header: 'Payables due', accessor: (row: any) => `₹${row.balance.toLocaleString()}` },
              { header: 'Status', accessor: 'status' },
              {
                header: 'Actions',
                accessor: (row: any) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete('suppliers', row.id, row.name);
                    }}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                    title="Delete supplier"
                  >
                    <Trash2 size={14} />
                  </button>
                ),
                className: 'w-20 text-center'
              }
            ]}
            searchPlaceholder="Search supplier name..."
            searchField="name"
            exportFileName="suppliers_master"
          />
        )}

        {activeTab === 'farmers' && (
          <DataTable
            data={db.farmers}
            columns={[
              { header: 'Farmer Name', accessor: 'name', sortable: true },
              { header: 'Contact Phone', accessor: 'phone' },
              { header: 'Address Details', accessor: 'address' },
              { header: 'State Location', accessor: 'state' },
              { header: 'Advances / Payables due', accessor: (row: any) => `₹${row.balance.toLocaleString()}` },
              { header: 'Status', accessor: 'status' },
              {
                header: 'Actions',
                accessor: (row: any) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete('farmers', row.id, row.name);
                    }}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                    title="Delete farmer"
                  >
                    <Trash2 size={14} />
                  </button>
                ),
                className: 'w-20 text-center'
              }
            ]}
            searchPlaceholder="Search farmer name..."
            searchField="name"
            exportFileName="farmers_master"
          />
        )}

        {activeTab === 'commodities' && (
          <DataTable
            data={db.commodities}
            columns={[
              { header: 'Commodity', accessor: 'name', sortable: true },
              { header: 'SKU', accessor: 'sku' },
              { header: 'Category', accessor: 'category' },
              { header: 'UOM Unit', accessor: 'unit' },
              { header: 'HSN code', accessor: 'hsn' },
              { header: 'Base GST (%)', accessor: (row: any) => `${row.defaultGst}%` },
              { header: 'Avg Cost/MT', accessor: (row: any) => `₹${row.purchaseCost.toLocaleString()}` },
              { header: 'Market Price/MT', accessor: (row: any) => `₹${row.currentMarketPrice.toLocaleString()}` },
              { header: 'Reserved', accessor: (row: any) => `${row.reservedQty} MT` },
              { header: 'Available Stock', accessor: (row: any) => `${row.stockQty} MT` },
              {
                header: 'Actions',
                accessor: (row: any) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete('commodities', row.id, row.name);
                    }}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                    title="Delete commodity"
                  >
                    <Trash2 size={14} />
                  </button>
                ),
                className: 'w-20 text-center'
              }
            ]}
            searchPlaceholder="Search commodity..."
            searchField="name"
            exportFileName="commodities_master"
          />
        )}

        {activeTab === 'warehouses' && (
          <DataTable
            data={db.warehouses}
            columns={[
              { header: 'Warehouse Facility', accessor: 'name', sortable: true },
              { header: 'Physical Address', accessor: 'location' },
              { header: 'Total Capacity', accessor: (row: any) => `${row.capacityMT} MT` },
              { header: 'Used Capacity', accessor: (row: any) => `${row.usedCapacityMT} MT` },
              { header: 'Occupancy Used', accessor: (row: any) => `${Math.round((row.usedCapacityMT / row.capacityMT) * 100)}%` },
              { header: 'Status', accessor: 'status' },
              {
                header: 'Actions',
                accessor: (row: any) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete('warehouses', row.id, row.name);
                    }}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                    title="Delete warehouse"
                  >
                    <Trash2 size={14} />
                  </button>
                ),
                className: 'w-20 text-center'
              }
            ]}
            searchPlaceholder="Search warehouse..."
            searchField="name"
            exportFileName="warehouses_master"
          />
        )}

        {activeTab === 'bins' && (
          <DataTable
            data={db.bins}
            columns={[
              { header: 'Bin Name', accessor: 'name', sortable: true },
              { header: 'Bin Code', accessor: 'binCode' },
              { 
                header: 'Warehouse', 
                accessor: (row: any) => db.warehouses.find(w => w.id === row.warehouseId)?.name || 'Unknown' 
              },
              { 
                header: 'Allowed Crop', 
                accessor: (row: any) => db.commodities.find(c => c.id === row.allowedCommodityId)?.name || 'Any' 
              },
              { header: 'Capacity', accessor: (row: any) => `${row.capacityMT} MT` },
              { header: 'Occupied', accessor: (row: any) => `${row.occupiedMT} MT` },
              { header: 'Available', accessor: (row: any) => `${row.capacityMT - row.occupiedMT} MT` },
              { 
                header: 'Occupancy Used', 
                accessor: (row: any) => `${Math.round((row.occupiedMT / row.capacityMT) * 100)}%` 
              },
              {
                header: 'Actions',
                accessor: (row: any) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete('bins', row.id, row.name);
                    }}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                    title="Delete bin"
                  >
                    <Trash2 size={14} />
                  </button>
                ),
                className: 'w-20 text-center'
              }
            ]}
            searchPlaceholder="Search bin name or code..."
            searchField="name"
            exportFileName="silo_bins_master"
          />
        )}

        {activeTab === 'vehicles' && (
          <DataTable
            data={db.vehicles}
            columns={[
              { header: 'Vehicle Plate No', accessor: 'number', sortable: true },
              { header: 'Vehicle Chassis Type', accessor: 'type' },
              { header: 'Capacity Tonnage', accessor: (row: any) => `${row.capacityMT} MT` },
              { 
                header: 'Driver Assigned', 
                accessor: (row: any) => db.drivers.find(d => d.id === row.driverId)?.name || 'Unassigned' 
              },
              { header: 'Logistics Status', accessor: 'status' },
              {
                header: 'Actions',
                accessor: (row: any) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete('vehicles', row.id, row.number);
                    }}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                    title="Delete vehicle"
                  >
                    <Trash2 size={14} />
                  </button>
                ),
                className: 'w-20 text-center'
              }
            ]}
            searchPlaceholder="Search vehicle plates..."
            searchField="number"
            exportFileName="fleet_vehicles_master"
          />
        )}

        {activeTab === 'drivers' && (
          <DataTable
            data={db.drivers}
            columns={[
              { header: 'Driver Name', accessor: 'name', sortable: true },
              { header: 'Contact Phone', accessor: 'phone' },
              { header: 'License Number', accessor: 'licenseNumber' },
              { header: 'Status', accessor: 'status' },
              {
                header: 'Actions',
                accessor: (row: any) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete('drivers', row.id, row.name);
                    }}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer inline-flex items-center justify-center"
                    title="Delete driver"
                  >
                    <Trash2 size={14} />
                  </button>
                ),
                className: 'w-20 text-center'
              }
            ]}
            searchPlaceholder="Search driver name..."
            searchField="name"
            exportFileName="fleet_drivers_master"
          />
        )}
      </div>

      {/* Creation Modal form drawer */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Register Master Entry: <span className="capitalize">{activeTab}</span></h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Define core properties for system operations directories.</p>
              </div>
              <button 
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddMaster} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Partner Profiles (Customers, Suppliers, Farmers) fields */}
              {(activeTab === 'customers' || activeTab === 'suppliers' || activeTab === 'farmers') && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Company / Contact Name *</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Ramesh Kumar Grain Farms"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Phone Number</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="e.g. +91 99887 76655"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Email Address</label>
                      <input
                        type="email"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="e.g. contact@farm.com"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">State Location</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                        value={state}
                        onChange={e => setState(e.target.value)}
                        placeholder="e.g. Bihar"
                        required
                      />
                    </div>
                  </div>

                  {activeTab !== 'farmers' && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">GSTIN Registration Number *</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 font-mono focus:outline-none"
                        value={gstin}
                        onChange={e => setGstin(e.target.value)}
                        placeholder="e.g. 10AAAFS4829K1Z4"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Billing Address Location</label>
                    <textarea
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none min-h-[50px]"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="Street, City, Pin details..."
                    />
                  </div>
                </>
              )}

              {/* Commodities fields */}
              {activeTab === 'commodities' && (
                <>
                  <div className="mb-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Commodity Name *</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Mustard Seeds (Sarso)"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Category</label>
                      <select
                        value={category}
                        onChange={e => setCategory(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                      >
                        <option value="Grains">Grains</option>
                        <option value="Oilseeds">Oilseeds</option>
                        <option value="Pulses">Pulses</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">UOM Unit</label>
                      <select
                        value={unit}
                        onChange={e => setUnit(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                      >
                        <option value="MT">Metric Ton (MT)</option>
                        <option value="Qtl">Quintal (Qtl)</option>
                        <option value="Kg">Kilogram (Kg)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">GST Tax Rate (%)</label>
                      <select
                        value={defaultGst}
                        onChange={e => setDefaultGst(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                      >
                        <option value="0">0% (exempt)</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">HSN Code</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                        value={hsn}
                        onChange={e => setHsn(e.target.value)}
                        placeholder="e.g. 10019910"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Minimum Safety Stock Level</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                        value={minStock}
                        onChange={e => setMinStock(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Base Cost/MT (₹)</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                        value={cost}
                        onChange={e => setCost(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Live Market/MT (₹)</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                        value={market}
                        onChange={e => setMarket(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Target Price/MT (₹)</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                        value={target}
                        onChange={e => setTarget(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Warehouses fields */}
              {activeTab === 'warehouses' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Warehouse Name *</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Bihta Warehouse Complex"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Capacity (MT)</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                        value={capacity}
                        onChange={e => setCapacity(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Physical Address Location *</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="Street, City details..."
                      required
                    />
                  </div>
                </>
              )}

              {/* Bins fields */}
              {activeTab === 'bins' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Bin / Silo Name *</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Patna Silo 3 - Mustard Exclusive"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Bin Code *</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 font-mono"
                        value={binCode}
                        onChange={e => setBinCode(e.target.value)}
                        placeholder="e.g. BIN-PA-S03"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Warehouse Facility *</label>
                      <select
                        value={binWarehouseId}
                        onChange={e => setBinWarehouseId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 focus:outline-none"
                        required
                      >
                        <option value="">Select Warehouse</option>
                        {db.warehouses.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Allowed Crop / Commodity *</label>
                      <select
                        value={binAllowedCommodityId}
                        onChange={e => setBinAllowedCommodityId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 focus:outline-none"
                        required
                      >
                        <option value="">Select Commodity</option>
                        {db.commodities.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Bin Capacity (MT) *</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 focus:outline-none"
                      value={capacity}
                      onChange={e => setCapacity(Number(e.target.value))}
                      required
                    />
                  </div>
                </>
              )}

              {/* Vehicles fields */}
              {activeTab === 'vehicles' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Vehicle License Plate No *</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                        value={vehicleNo}
                        onChange={e => setVehicleNo(e.target.value)}
                        placeholder="e.g. BR-01-GB-1234"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Vehicle Truck Chassis Type</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                        value={vehicleType}
                        onChange={e => setVehicleType(e.target.value)}
                        placeholder="e.g. Tata 1613 Truck"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payload Weight Capacity (MT)</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                        value={capacity}
                        onChange={e => setCapacity(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Assign Active Driver</label>
                      <select
                        value={driverId}
                        onChange={e => setDriverId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700 focus:outline-none"
                      >
                        <option value="">Unassigned</option>
                        {db.drivers.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Drivers fields */}
              {activeTab === 'drivers' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Driver Full Name *</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Suresh Singh"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Driver Phone Number</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-700"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="e.g. +91 88776 65544"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Driver HGV License Number *</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium text-slate-750 font-mono"
                      value={license}
                      onChange={e => setLicense(e.target.value)}
                      placeholder="e.g. DL-10201500789"
                      required
                    />
                  </div>
                </>
              )}

              {/* Form Actions */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-655 rounded-lg text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold shadow-md shadow-primary-600/10 transition"
                >
                  Register Master
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


export default function MastersHubPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs font-semibold text-slate-400">Loading module...</div>}>
      <MastersHubPageContent />
    </React.Suspense>
  );
}
