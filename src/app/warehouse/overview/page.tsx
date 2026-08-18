'use client';

import React, { useMemo } from 'react';
import { useErp } from '../../../context/ErpContext';
import StatCard from '../../../components/shared/StatCard';
import { Warehouse, Layers, ArrowDownLeft, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function WarehouseOverviewPage() {
  const { db } = useErp();
  const router = useRouter();

  const warehouses = db.warehouses;
  const bins = db.bins;
  const stockItems = db.stockItems;

  const summary = useMemo(() => {
    const totalCapacity = warehouses.reduce((sum, w) => sum + w.capacityMT, 0);
    const usedCapacity = warehouses.reduce((sum, w) => sum + w.usedCapacityMT, 0);
    const availableCapacity = totalCapacity - usedCapacity;
    const stockVal = stockItems.reduce((sum, item) => sum + (item.quantity * item.purchaseCost), 0);
    return {
      totalCapacity,
      usedCapacity,
      availableCapacity,
      stockVal
    };
  }, [warehouses, stockItems]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Warehouse Overview</h1>
          <p className="text-xs font-medium text-slate-400">Monitor storage terminal capacities, active silo bins, and asset valuation.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/warehouse/inward')}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-655 rounded-lg font-bold text-xs cursor-pointer transition"
          >
            <ArrowDownLeft size={14} />
            <span>Goods Inward</span>
          </button>
          <button
            onClick={() => router.push('/warehouse/transfers')}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md shadow-primary-600/10 transition"
          >
            <ArrowUpRight size={14} />
            <span>Bin Transfers</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Storage Units" value={warehouses.length} icon={Warehouse} color="primary" />
        <StatCard title="Total Silo Capacity" value={`${summary.totalCapacity} MT`} icon={Layers} color="info" />
        <StatCard title="Storage Space Used" value={`${summary.usedCapacity} MT (${Math.round((summary.usedCapacity / summary.totalCapacity) * 100)}%)`} icon={Layers} color="warning" />
        <StatCard title="Warehouse Assets Sourced" value={`₹${summary.stockVal.toLocaleString()}`} icon={ShieldCheck} color="success" />
      </div>

      {/* Warehouses list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {warehouses.map(wh => {
          const whBins = bins.filter(b => b.id.startsWith(wh.id.replace('WH-', 'WH0')));
          const percent = Math.round((wh.usedCapacityMT / wh.capacityMT) * 100);

          return (
            <div key={wh.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{wh.name}</h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{wh.location}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                  wh.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600'
                }`}>
                  {wh.status}
                </span>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5 text-xs font-semibold text-slate-600">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Occupancy: {wh.usedCapacityMT} / {wh.capacityMT} MT</span>
                  <span>{percent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-amber-500' : 'bg-primary-600'
                    }`} 
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              {/* Bins List */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Physical Bins Status</span>
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {whBins.map(bin => {
                    const binPercent = Math.round((bin.occupiedMT / bin.capacityMT) * 100);
                    return (
                      <div key={bin.id} className="border border-slate-100 rounded-lg p-2.5 bg-slate-50/50 text-xs font-medium">
                        <div className="flex justify-between items-center font-bold mb-1.5 text-slate-700">
                          <span>{bin.name.split(' - ').slice(1).join(' - ')}</span>
                          <span className="text-[10px] text-slate-400">{bin.occupiedMT} / {bin.capacityMT} MT</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              binPercent >= 90 ? 'bg-red-500' : binPercent >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
                            }`} 
                            style={{ width: `${binPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
