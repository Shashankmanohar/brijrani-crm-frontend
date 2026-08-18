'use client';

import React, { useMemo } from 'react';
import { useErp } from '../../../context/ErpContext';
import { StockItem } from '../../../types/erp';
import DataTable from '../../../components/shared/DataTable';
import { Layers, AlertTriangle, ArrowUpRight, TrendingUp, DollarSign } from 'lucide-react';

export default function StockInventoryPage() {
  const { db } = useErp();

  const commodities = db.commodities;
  const warehouses = db.warehouses;
  const bins = db.bins;

  // Compile row data with calculations
  const stockRows = useMemo(() => {
    return db.stockItems.map(item => {
      const commodity = commodities.find(c => c.id === item.commodityId);
      const warehouse = warehouses.find(w => w.id === item.warehouseId);
      const bin = bins.find(b => b.id === item.binId);

      const purchaseCost = item.purchaseCost;
      const marketPrice = commodity?.currentMarketPrice || purchaseCost;
      const stockVal = item.quantity * purchaseCost;
      const profit = (marketPrice - purchaseCost) * item.quantity;
      const profitPct = purchaseCost > 0 ? Math.round(((marketPrice - purchaseCost) / purchaseCost) * 100) : 0;

      // Status indicator
      const available = (commodity?.stockQty || 0) - (commodity?.reservedQty || 0);
      let status: 'Low Stock' | 'Reserved' | 'Good' = 'Good';
      if (available <= (commodity?.minStockLevel || 0)) {
        status = 'Low Stock';
      } else if ((commodity?.reservedQty || 0) > 0 && item.commodityId === commodity?.id) {
        status = 'Reserved';
      }

      return {
        id: item.id,
        commodityId: item.commodityId,
        commodityName: commodity?.name || 'Unknown',
        sku: commodity?.sku || '',
        batchNo: item.batchNo,
        warehouseName: warehouse?.name || 'Unknown',
        warehouseId: item.warehouseId,
        binName: bin?.name || item.binId,
        quantity: item.quantity,
        unit: item.unit,
        purchaseCost,
        marketPrice,
        stockVal,
        profit,
        profitPct,
        status
      };
    });
  }, [db]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalVal = stockRows.reduce((sum, r) => sum + r.stockVal, 0);
    const totalProfit = stockRows.reduce((sum, r) => sum + r.profit, 0);
    const lowStockCount = commodities.filter(c => (c.stockQty - c.reservedQty) <= c.minStockLevel).length;
    return {
      totalVal,
      totalProfit,
      lowStockCount
    };
  }, [stockRows, commodities]);

  const columns = [
    { header: 'Commodity', accessor: 'commodityName' as any, sortable: true },
    { header: 'SKU', accessor: 'sku' as any },
    { 
      header: 'Batch No', 
      accessor: (row: any) => <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.2 rounded text-slate-700">{row.batchNo}</span>,
      csvAccessor: 'batchNo' as any
    },
    { header: 'Warehouse', accessor: 'warehouseName' as any },
    { header: 'Bin/Rack', accessor: 'binName' as any },
    { header: 'Qty', accessor: (row: any) => `${row.quantity} ${row.unit}` },
    { header: 'Avg Cost/MT', accessor: (row: any) => `₹${row.purchaseCost.toLocaleString()}` },
    { header: 'Market/MT', accessor: (row: any) => `₹${row.marketPrice.toLocaleString()}` },
    { header: 'Stock Value', accessor: (row: any) => `₹${row.stockVal.toLocaleString()}` },
    { 
      header: 'Profit Arbitrage', 
      accessor: (row: any) => (
        <span className={`font-bold flex items-center gap-0.5 ${row.profit > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
          {row.profit > 0 ? <ArrowUpRight size={12} /> : null}
          ₹{row.profit.toLocaleString()} ({row.profitPct}%)
        </span>
      ),
      csvAccessor: (row: any) => `₹${row.profit} (${row.profitPct}%)`
    },
    { 
      header: 'Status', 
      accessor: (row: any) => (
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
          row.status === 'Low Stock' ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' :
          row.status === 'Reserved' ? 'bg-blue-50 text-blue-600 border-blue-200' :
          'bg-green-50 text-green-600 border-green-200'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  // Filters setup
  const whOptions = warehouses.map(w => ({ label: w.name, value: w.id }));
  const cmdOptions = commodities.map(c => ({ label: c.name, value: c.id }));

  const filterConfigs = [
    { name: 'Warehouse', field: 'warehouseId', options: whOptions },
    { name: 'Commodity', field: 'commodityId', options: cmdOptions }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800">Advanced Stock Management</h1>
        <p className="text-xs font-medium text-slate-400">View real-time batch allocation, purchase costing, and market profit analyses.</p>
      </div>

      {/* Stats Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Inventory Asset Value</span>
            <span className="text-lg font-bold text-slate-800">₹{stats.totalVal.toLocaleString()}</span>
          </div>
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Potential Profit</span>
            <span className="text-lg font-bold text-emerald-600">₹{stats.totalProfit.toLocaleString()}</span>
          </div>
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Low Stock Commodities</span>
            <span className={`text-lg font-bold ${stats.lowStockCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {stats.lowStockCount} items
            </span>
          </div>
          <div className={`p-2 rounded-lg ${stats.lowStockCount > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* Stock list */}
      <DataTable
        data={stockRows}
        columns={columns}
        searchPlaceholder="Search commodity, SKU or batch..."
        searchField="commodityName"
        filters={filterConfigs}
        exportFileName="inventory_stock_valuation"
        pageSize={10}
      />
    </div>
  );
}
