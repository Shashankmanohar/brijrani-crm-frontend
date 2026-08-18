'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getDb, saveDb, erpService, mapToFrontend } from '../services/erpService';
import api from '../services/axios';

export interface ErpNotification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'danger';
  date: string;
  read: boolean;
}

export interface ErpToast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ErpContextType {
  currentCompany: string;
  setCompany: (company: string) => void;
  currentUserRole: string;
  setRole: (role: string) => void;
  notifications: ErpNotification[];
  addNotification: (message: string, type: 'info' | 'warning' | 'success' | 'danger') => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  toasts: ErpToast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  db: ReturnType<typeof getDb>;
  refreshDb: () => void;
  isLoggedIn: boolean;
  currentUser: { name: string; email: string } | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearAllData: () => void;
}

const ErpContext = createContext<ErpContextType | undefined>(undefined);

export const ErpProvider = ({ children }: { children: ReactNode }) => {
  const [currentCompany, setCompanyState] = useState<string>('BrijRani Agro Foods');
  const [currentUserRole, setRoleState] = useState<string>('Super Admin');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);
  const [notifications, setNotifications] = useState<ErpNotification[]>([]);
  const [toasts, setToasts] = useState<ErpToast[]>([]);
  const [db, setDb] = useState<ReturnType<typeof getDb>>(getDb());

  const refreshDb = () => {
    setDb(getDb());
  };

  // Restore session from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('brijrani_session_user');
      const storedExpiry = localStorage.getItem('brijrani_session_expiry');
      
      if (storedUser && storedExpiry) {
        const expiryTime = Number(storedExpiry);
        if (Date.now() < expiryTime) {
          try {
            const userObj = JSON.parse(storedUser);
            setIsLoggedIn(true);
            setCurrentUser({ name: userObj.name, email: userObj.email });
            setRoleState(userObj.role);
          } catch (e) {
            console.error('Failed to restore session:', e);
          }
        } else {
          // Clean up expired session
          localStorage.removeItem('brijrani_session_user');
          localStorage.removeItem('brijrani_session_expiry');
        }
      }
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const resData = response.data;
      if (resData && resData.success) {
        const { user } = resData.data;
        setIsLoggedIn(true);
        setCurrentUser({ name: user.name, email: user.email });
        setRoleState(user.role);

        const expiry = Date.now() + 60 * 60 * 1000; // 1 Hour
        localStorage.setItem('brijrani_session_user', JSON.stringify({ name: user.name, email: user.email, role: user.role }));
        localStorage.setItem('brijrani_session_expiry', expiry.toString());

        showToast(`Logged in successfully as ${user.name}`, 'success');
        return true;
      }
      return false;
    } catch (e: any) {
      const errorMsg = e.response?.data?.message || 'Invalid email or password';
      showToast(errorMsg, 'error');
      return false;
    }
  };

  const logout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setRoleState('Super Admin');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('brijrani_session_user');
      localStorage.removeItem('brijrani_session_expiry');
    }
    showToast('Logged out successfully', 'info');
  };

  const clearAllData = () => {
    if (typeof window !== 'undefined') {
      const emptyDb = {
        farmers: [],
        suppliers: [],
        customers: [],
        commodities: [],
        warehouses: [],
        bins: [],
        vehicles: [],
        drivers: [],
        purchaseEnquiries: [],
        purchaseQuotations: [],
        purchaseOrders: [],
        grns: [],
        qualityInspections: [],
        stockItems: [],
        salesEnquiries: [],
        salesQuotations: [],
        salesOrders: [],
        pickingSlips: [],
        packingSlips: [],
        deliveryChallans: [],
        salesInvoices: [],
        ewayBills: [],
        pods: [],
        stockTransfers: [],
        vouchers: [],
        expenses: []
      };
      localStorage.setItem('brijrani_erp_database_v2', JSON.stringify(emptyDb));
      setDb(emptyDb);
      showToast('All CRM and ERP data has been cleared.', 'success');
    }
  };

  // Background timer checking session expiration
  useEffect(() => {
    if (!isLoggedIn) return;

    const checkSession = () => {
      if (typeof window !== 'undefined') {
        const storedExpiry = localStorage.getItem('brijrani_session_expiry');
        if (storedExpiry) {
          const expiryTime = Number(storedExpiry);
          if (Date.now() >= expiryTime) {
            logout();
            showToast('Your session has expired. Please log in again.', 'error');
          }
        }
      }
    };

    const intervalId = setInterval(checkSession, 15000); // Check every 15 seconds
    return () => clearInterval(intervalId);
  }, [isLoggedIn]);

  // Load live database from backend on startup & listen to sync events
  useEffect(() => {
    const fetchBackendData = async () => {
      try {
        const fields = ['customers', 'suppliers', 'farmers', 'commodities', 'warehouses', 'bins', 'vehicles', 'drivers'];
        const currentDb = getDb();
        
        await Promise.all(fields.map(async (field) => {
          try {
            const res = await api.get(`/masters/${field}`);
            const backendList = res.data?.data || [];
            const mappedList = backendList.map((item: any) => mapToFrontend(field, item));
            
            // Merge with local list to preserve transactional states
            const localList = currentDb[field as keyof typeof currentDb] || [];
            currentDb[field as keyof typeof currentDb] = mappedList.map((backendItem: any) => {
              const localItem = (localList as any[]).find((l: any) => l.id === backendItem.id);
              if (localItem) {
                const merged = { ...backendItem };
                if (field === 'bins') {
                  merged.occupiedMT = localItem.occupiedMT;
                } else if (field === 'commodities') {
                  merged.stockQty = localItem.stockQty;
                  merged.reservedQty = localItem.reservedQty;
                  merged.purchaseCost = localItem.purchaseCost;
                } else if (field === 'warehouses') {
                  merged.usedCapacityMT = localItem.usedCapacityMT;
                } else if (['customers', 'suppliers', 'farmers'].includes(field)) {
                  merged.balance = localItem.balance;
                } else if (field === 'vehicles' || field === 'drivers') {
                  merged.status = localItem.status;
                }
                return merged;
              }
              return backendItem;
            }) as any;
          } catch (e) {
            console.error(`Failed to fetch ${field} from backend:`, e);
          }
        }));

        // Fetch Sales Invoices from Backend Mongoose
        let liveInvoicesCount = 0;
        try {
          const resInvoices = await api.get('/sales/invoices');
          const backendInvoices = resInvoices.data?.data || [];
          if (backendInvoices.length > 0) {
            currentDb.salesInvoices = backendInvoices.map((item: any) => ({
              id: item._id,
              invoiceNo: item.invoiceNo,
              invoiceDate: item.invoiceDate ? item.invoiceDate.split('T')[0] : new Date().toISOString().split('T')[0],
              customerId: item.customerId,
              billingAddress: item.billingAddress || '',
              shippingAddress: item.shippingAddress || '',
              gstin: item.gstin || '',
              paymentStatus: item.paymentStatus || 'Unpaid',
              dueDate: item.dueDate ? item.dueDate.split('T')[0] : '',
              items: (item.items || []).map((i: any) => ({
                commodityId: i.commodityId,
                quantity: i.quantity || 0,
                rate: i.rate || 0,
                hsn: i.hsn || '',
                taxableAmount: i.taxableAmount || 0,
                cgst: i.cgst || 0,
                sgst: i.sgst || 0,
                igst: i.igst || 0
              })),
              taxableAmount: item.taxableAmount || 0,
              cgst: item.cgst || 0,
              sgst: item.sgst || 0,
              igst: item.igst || 0,
              freight: item.freight || 0,
              grandTotal: item.grandTotal || 0
            }));
            liveInvoicesCount = backendInvoices.length;
          }
        } catch (e) {
          console.error('Failed to fetch sales invoices from backend:', e);
        }

        // Fetch Vouchers & Expenses from Backend Mongoose
        let liveExpensesCount = 0;
        try {
          const resVouchers = await api.get('/finance/vouchers');
          const backendVouchers = resVouchers.data?.data || [];
          if (backendVouchers.length > 0) {
            currentDb.vouchers = backendVouchers.map((item: any) => ({
              id: item._id,
              voucherNo: item.voucherNumber,
              voucherType: item.voucherType,
              date: item.date ? item.date.split('T')[0] : new Date().toISOString().split('T')[0],
              referenceNo: item.reference || '',
              partyId: item.partyId || '',
              partyType: item.partyType === 'supplier' || item.partyType === 'customer' || item.partyType === 'farmer' ? item.partyType : 'none',
              amount: item.amount || 0,
              paymentMode: item.paymentMode || 'Cash',
              cashBankLink: item.paymentMode === 'Cash' ? 'Petty Cash' : 'HDFC Bank A/c',
              debitAccount: item.voucherType === 'Payment' || item.voucherType === 'Expense' ? 'Expense/Payable A/c' : 'Cash/Bank A/c',
              creditAccount: item.voucherType === 'Receipt' || item.voucherType === 'Income' ? 'Revenue/Receivable A/c' : 'Cash/Bank A/c',
              narration: item.narration || '',
              status: item.status || 'Approved',
              createdBy: item.createdBy || 'System'
            }));

            const backendExpenses = backendVouchers.filter((item: any) => item.voucherType === 'Expense' || item.voucherType === 'Payment');
            if (backendExpenses.length > 0) {
              currentDb.expenses = backendExpenses.map((item: any) => {
                const narrationLower = (item.narration || '').toLowerCase();
                let category = 'Other';
                if (narrationLower.includes('wage') || narrationLower.includes('labor') || narrationLower.includes('salary')) {
                  category = 'Wages';
                } else if (narrationLower.includes('rent') || narrationLower.includes('silo')) {
                  category = 'Rent';
                } else if (narrationLower.includes('fuel') || narrationLower.includes('freight') || narrationLower.includes('transport')) {
                  category = 'Fuel';
                } else if (narrationLower.includes('office') || narrationLower.includes('admin') || narrationLower.includes('stationery')) {
                  category = 'Office';
                }
                
                return {
                  id: item._id,
                  expenseNo: item.voucherNumber,
                  category,
                  vendor: item.partyType || 'General Overhead',
                  amount: item.amount || 0,
                  gstAmount: 0,
                  totalAmount: item.amount || 0,
                  paymentMode: item.paymentMode === 'Bank Transfer' ? 'Bank Transfer' : item.paymentMode === 'UPI' ? 'UPI' : 'Cash',
                  date: item.date ? item.date.split('T')[0] : new Date().toISOString().split('T')[0],
                  referenceNo: item.reference || '',
                  narration: item.narration || ''
                };
              });
              liveExpensesCount = backendExpenses.length;
            }
          }
        } catch (e) {
          console.error('Failed to fetch vouchers/expenses from backend:', e);
        }

        // Seed demo transactions dynamically if empty (keeps the Profit & Loss statement looking full and premium on startup)
        if (liveInvoicesCount === 0 && liveExpensesCount === 0 && currentDb.salesInvoices.length === 0 && currentDb.expenses.length === 0) {
          const wheat = currentDb.commodities.find((c: any) => c.sku === 'CMD-001' || c.name.toLowerCase().includes('wheat'));
          const paddy = currentDb.commodities.find((c: any) => c.sku === 'CMD-002' || c.name.toLowerCase().includes('paddy'));
          const mustard = currentDb.commodities.find((c: any) => c.sku === 'CMD-003' || c.name.toLowerCase().includes('mustard'));
          const customer = currentDb.customers[0];

          if (customer && wheat && paddy && mustard) {
            currentDb.salesInvoices = [
              {
                id: `SINV-1001`,
                invoiceNo: `SINV/BR/2026-27/001`,
                invoiceDate: '2026-08-04',
                customerId: customer.id,
                gstin: customer.gstin || '10AAACR0912K1Z8',
                billingAddress: customer.address || '',
                shippingAddress: customer.address || '',
                items: [
                  {
                    commodityId: wheat.id,
                    hsn: '1001',
                    quantity: 20,
                    rate: 27500,
                    discount: 0,
                    taxableAmount: 20 * 27500,
                    cgst: (20 * 27500) * 0.025,
                    sgst: (20 * 27500) * 0.025,
                    igst: 0,
                    total: (20 * 27500) * 1.05
                  }
                ],
                taxableAmount: 20 * 27500,
                cgst: (20 * 27500) * 0.025,
                sgst: (20 * 27500) * 0.025,
                igst: 0,
                freight: 0,
                otherCharges: 0,
                grandTotal: (20 * 27500) * 1.05,
                dueDate: '2026-09-04',
                paymentStatus: 'Paid'
              },
              {
                id: `SINV-1002`,
                invoiceNo: `SINV/BR/2026-27/002`,
                invoiceDate: '2026-08-10',
                customerId: customer.id,
                gstin: customer.gstin || '10AAACR0912K1Z8',
                billingAddress: customer.address || '',
                shippingAddress: customer.address || '',
                items: [
                  {
                    commodityId: paddy.id,
                    hsn: '1006',
                    quantity: 15,
                    rate: 24000,
                    discount: 0,
                    taxableAmount: 15 * 24000,
                    cgst: (15 * 24000) * 0.025,
                    sgst: (15 * 24000) * 0.025,
                    igst: 0,
                    total: (15 * 24000) * 1.05
                  }
                ],
                taxableAmount: 15 * 24000,
                cgst: (15 * 24000) * 0.025,
                sgst: (15 * 24000) * 0.025,
                igst: 0,
                freight: 0,
                otherCharges: 0,
                grandTotal: (15 * 24000) * 1.05,
                dueDate: '2026-09-10',
                paymentStatus: 'Paid'
              },
              {
                id: `SINV-1003`,
                invoiceNo: `SINV/BR/2026-27/003`,
                invoiceDate: '2026-08-12',
                customerId: customer.id,
                gstin: customer.gstin || '10AAACR0912K1Z8',
                billingAddress: customer.address || '',
                shippingAddress: customer.address || '',
                items: [
                  {
                    commodityId: mustard.id,
                    hsn: '1207',
                    quantity: 10,
                    rate: 56000,
                    discount: 0,
                    taxableAmount: 10 * 56000,
                    cgst: (10 * 56000) * 0.025,
                    sgst: (10 * 56000) * 0.025,
                    igst: 0,
                    total: (10 * 56000) * 1.05
                  }
                ],
                taxableAmount: 10 * 56000,
                cgst: (10 * 56000) * 0.025,
                sgst: (10 * 56000) * 0.025,
                igst: 0,
                freight: 0,
                otherCharges: 0,
                grandTotal: (10 * 56000) * 1.05,
                dueDate: '2026-09-12',
                paymentStatus: 'Unpaid'
              }
            ];

            currentDb.expenses = [
              {
                id: `EXP-1`,
                expenseNo: `EXP/2026-27/001`,
                category: 'Rent',
                vendor: 'Patna Silos Facilities Corp',
                amount: 45000,
                gstAmount: 8100,
                totalAmount: 53100,
                paymentMode: 'Bank Transfer',
                date: '2026-08-05',
                narration: 'Monthly rental for grain silo structures'
              },
              {
                id: `EXP-2`,
                expenseNo: `EXP/2026-27/002`,
                category: 'Wages',
                vendor: 'Daily Wages Contract Labor',
                amount: 18500,
                gstAmount: 0,
                totalAmount: 18500,
                paymentMode: 'Cash',
                date: '2026-08-08',
                narration: 'Wages for truck loading and unloading helpers'
              },
              {
                id: `EXP-3`,
                expenseNo: `EXP/2026-27/003`,
                category: 'Fuel',
                vendor: 'Indian Oil Depot',
                amount: 32000,
                gstAmount: 0,
                totalAmount: 32000,
                paymentMode: 'UPI',
                date: '2026-08-11',
                narration: 'Fuel cards refill for outbound trucks'
              },
              {
                id: `EXP-4`,
                expenseNo: `EXP/2026-27/004`,
                category: 'Office',
                vendor: 'BSNL Broadband & Stationers',
                amount: 4500,
                gstAmount: 810,
                totalAmount: 5310,
                paymentMode: 'UPI',
                date: '2026-08-13',
                narration: 'Internet charges and printer cartridge purchase'
              }
            ];
          }
        }

        saveDb(currentDb);
        refreshDb();
      } catch (err) {
        console.error('Failed to sync database with backend:', err);
      }
    };

    fetchBackendData();

    const handleSync = () => {
      refreshDb();
    };
    window.addEventListener('erp-db-sync', handleSync);
    return () => window.removeEventListener('erp-db-sync', handleSync);
  }, []);

  const setCompany = (comp: string) => {
    setCompanyState(comp);
    showToast(`Switched company to ${comp}`, 'info');
  };

  const setRole = (role: string) => {
    setRoleState(role);
    showToast(`Switched user role to ${role}`, 'info');
    
    // Update the session storage role if we switch it (for Super Admin testing)
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('brijrani_session_user');
      if (stored) {
        try {
          const userObj = JSON.parse(stored);
          userObj.role = role;
          localStorage.setItem('brijrani_session_user', JSON.stringify(userObj));
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  // Toast functions
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Notifications functions
  const addNotification = (message: string, type: 'info' | 'warning' | 'success' | 'danger') => {
    const newNotif: ErpNotification = {
      id: `notif-${Date.now()}`,
      message,
      type,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    showToast('All notifications marked as read', 'info');
  };

  // Hydrate initial database warnings on load
  useEffect(() => {
    const currentDb = getDb();
    const initialNotifs: ErpNotification[] = [];

    // 1. Check for expired or expiring E-Way Bills
    currentDb.ewayBills.forEach(ewb => {
      if (ewb.status === 'Active' && new Date(ewb.validUntil) < new Date()) {
        initialNotifs.push({
          id: `notif-ewb-${ewb.id}`,
          message: `E-Way Bill #${ewb.ewayBillNo} for Invoice ${ewb.invoiceNo} has expired.`,
          type: 'danger',
          date: '10:15 AM',
          read: false
        });
      }
    });

    // 2. Check for low stock levels
    currentDb.commodities.forEach(cmd => {
      const available = cmd.stockQty - cmd.reservedQty;
      if (available <= cmd.minStockLevel) {
        initialNotifs.push({
          id: `notif-stock-${cmd.id}`,
          message: `Low Stock Alert: ${cmd.name} has only ${available} ${cmd.unit} available (Min: ${cmd.minStockLevel}).`,
          type: 'warning',
          date: '09:30 AM',
          read: false
        });
      }
    });

    // 3. Check for quality inspection pending
    currentDb.grns.forEach(grn => {
      if (grn.qualityStatus === 'Pending') {
        initialNotifs.push({
          id: `notif-qc-${grn.id}`,
          message: `Quality Inspection Pending for GRN #${grn.grnNo} (${grn.receivedQty} MT Wheat).`,
          type: 'info',
          date: '08:45 AM',
          read: false
        });
      }
    });

    // 4. Check for market price alerts (target price reached)
    currentDb.commodities.forEach(cmd => {
      if (cmd.currentMarketPrice >= (cmd.targetPrice ?? 0)) {
        initialNotifs.push({
          id: `notif-price-${cmd.id}`,
          message: `Target Price Reached! ${cmd.name} market price is ₹${cmd.currentMarketPrice.toLocaleString()}/MT (Target: ₹${(cmd.targetPrice ?? 0).toLocaleString()}). Ready to sell!`,
          type: 'success',
          date: 'Yesterday',
          read: false
        });
      }
    });

    setNotifications(initialNotifs);
  }, [db]);

  return (
    <ErpContext.Provider value={{
      currentCompany,
      setCompany,
      currentUserRole,
      setRole,
      notifications,
      addNotification,
      markNotificationRead,
      markAllNotificationsRead,
      toasts,
      showToast,
      removeToast,
      db,
      refreshDb,
      isLoggedIn,
      currentUser,
      login,
      logout,
      clearAllData
    }}>
      {children}

      {/* Floating Toast Notification Stack */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full">
        {toasts.map(t => (
          <div
            key={t.id}
            onClick={() => removeToast(t.id)}
            className={`p-3 rounded-lg shadow-lg text-white text-sm font-medium flex items-center justify-between cursor-pointer animate-slide-in transition-all duration-300 ${
              t.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' :
              t.type === 'error' ? 'bg-red-600 hover:bg-red-700' :
              'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            <span>{t.message}</span>
            <button className="text-white/80 hover:text-white ml-3 text-xs font-bold">&times;</button>
          </div>
        ))}
      </div>
    </ErpContext.Provider>
  );
};

export const useErp = () => {
  const context = useContext(ErpContext);
  if (!context) {
    throw new Error('useErp must be used within an ErpProvider');
  }
  return context;
};
