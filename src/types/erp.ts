export interface Farmer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  state: string;
  gstin?: string;
  balance: number; // Positive is payable (we owe them)
  status: 'Active' | 'Inactive';
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  state: string;
  gstin: string;
  balance: number; // Positive is payable (we owe them)
  status: 'Active' | 'Inactive';
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  state: string;
  gstin: string;
  balance: number; // Positive is receivable (they owe us)
  status: 'Active' | 'Inactive';
}

export interface Commodity {
  id: string;
  name: string;
  sku: string;
  category: 'Grains' | 'Oilseeds' | 'Pulses' | 'Other';
  unit: 'MT' | 'Qtl' | 'Kg';
  hsn: string;
  defaultGst: number; // e.g. 5
  purchaseCost: number; // Avg cost per unit
  currentMarketPrice: number; // Market price per unit
  targetPrice: number; // Trigger alerts when market price is >= target
  stockQty: number; // Total available
  reservedQty: number; // Allocated to Sales Orders but not dispatched
  minStockLevel: number;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  capacityMT: number;
  usedCapacityMT: number;
  status: 'Active' | 'Inactive';
}

export interface Zone {
  id: string;
  warehouseId: string;
  name: string;
}

export interface Rack {
  id: string;
  zoneId: string;
  name: string;
}

export interface Bin {
  id: string;
  rackId: string;
  name: string;
  capacityMT: number;
  occupiedMT: number;
  warehouseId?: string;
  allowedCommodityId?: string;
  binCode?: string;
}

export interface Vehicle {
  id: string;
  number: string;
  type: string;
  capacityMT: number;
  driverId?: string;
  status: 'Available' | 'On Route' | 'Maintenance';
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  licenseNumber: string;
  status: 'Active' | 'On Route' | 'Inactive';
}

// Procurement Flows
export type DocumentStatus = 'Draft' | 'Sent' | 'Under Negotiation' | 'Approved' | 'Rejected' | 'Cancelled' | 'Converted' | 'Completed' | 'Pending Approval';

export interface PurchaseEnquiry {
  id: string;
  enquiryNo: string;
  date: string;
  partyType: 'supplier' | 'farmer';
  partyId: string;
  commodityId: string;
  quantity: number;
  unit: 'MT' | 'Qtl' | 'Kg';
  expectedPrice: number;
  requiredDate: string;
  warehouseId: string;
  notes?: string;
  status: DocumentStatus;
}

export interface PurchaseQuotation {
  id: string;
  quotationNo: string;
  enquiryNo?: string;
  date: string;
  partyType: 'supplier' | 'farmer';
  partyId: string;
  commodityId: string;
  quantity: number;
  rate: number;
  transportCost: number;
  loadingCost: number;
  otherCharges: number;
  gstPercent: number;
  total: number;
  validUntil: string;
  paymentTerms: string;
  deliveryTerms: string;
  status: DocumentStatus;
}

export interface ApprovalHistoryItem {
  step: string;
  user: string;
  action: 'Created' | 'Approved' | 'Rejected' | 'Changes Requested';
  date: string;
  comment?: string;
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  quotationNo?: string;
  date: string;
  partyType: 'supplier' | 'farmer';
  partyId: string;
  commodityId: string;
  quantity: number;
  rate: number;
  transportCost: number;
  otherCharges: number;
  gstPercent: number;
  total: number;
  expectedDelivery: string;
  warehouseId: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Partially Received' | 'Received' | 'Cancelled';
  notes?: string;
  approvalHistory: ApprovalHistoryItem[];
}

export interface GRN {
  id: string;
  grnNo: string;
  poId: string;
  poNo: string;
  date: string;
  partyType: 'supplier' | 'farmer';
  partyId: string;
  vehicleNo: string;
  driverName: string;
  arrivalDate: string;
  warehouseId: string;
  commodityId: string;
  orderedQty: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  weight: number;
  batchNo: string;
  qualityStatus: 'Pending' | 'Passed' | 'Rejected' | 'Partially Passed';
  inwardStatus: 'Pending' | 'Completed';
}

export interface QualityInspection {
  id: string;
  grnId: string;
  grnNo: string;
  commodityId: string;
  batchNo: string;
  quantity: number;
  moisturePercent: number;
  grade: 'A' | 'B' | 'C' | 'Rejected';
  weight: number;
  color: string;
  foreignMaterialPercent: number;
  damagePercent: number;
  qualityScore: number; // 0 to 100
  inspector: string;
  date: string;
  status: 'Pending' | 'Passed' | 'Partially Passed' | 'Rejected';
  notes?: string;
}

export interface StockItem {
  id: string;
  commodityId: string;
  batchNo: string;
  warehouseId: string;
  binId: string; // Format: Zone-Rack-Bin
  quantity: number;
  unit: 'MT' | 'Qtl' | 'Kg';
  purchaseCost: number; // Purchase price for this batch
  averageCost: number;
  entryDate: string;
}

export interface StockTransfer {
  id: string;
  transferNo: string;
  commodityId: string;
  batchNo: string;
  fromWarehouseId: string;
  fromBinId: string;
  toWarehouseId: string;
  toBinId: string;
  quantity: number;
  transferDate: string;
  reason: string;
  vehicleNo?: string;
  driverName?: string;
  status: 'Draft' | 'Approved' | 'In Transit' | 'Completed';
}

// Sales Flows
export interface SalesEnquiry {
  id: string;
  enquiryNo: string;
  date: string;
  customerId: string;
  commodityId: string;
  quantity: number;
  expectedRate: number;
  requiredDeliveryDate: string;
  deliveryLocation: string;
  notes?: string;
  status: DocumentStatus;
}

export interface SalesQuotation {
  id: string;
  quotationNo: string;
  enquiryNo?: string;
  date: string;
  customerId: string;
  commodityId: string;
  quantity: number;
  rate: number;
  gstPercent: number;
  freightCost: number;
  loadingCost: number;
  otherCharges: number;
  discountAmount: number;
  total: number;
  validUntil: string;
  paymentTerms: string;
  deliveryTerms: string;
  purchaseCost: number; // Benchmark for margins
  expectedProfit: number; // rate * qty - purchaseCost * qty
  status: DocumentStatus;
}

export interface SalesOrder {
  id: string;
  soNo: string;
  quotationNo?: string;
  date: string;
  customerId: string;
  commodityId: string;
  quantity: number;
  rate: number;
  gstPercent: number;
  freightCost: number;
  total: number;
  warehouseId: string;
  deliveryLocation: string;
  expectedDispatch: string;
  paymentTerms: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Picking' | 'Packing' | 'Shipped' | 'Completed' | 'Cancelled';
  notes?: string;
}

export interface PickingSlip {
  id: string;
  pickingNo: string;
  soId: string;
  soNo: string;
  date: string;
  warehouseId: string;
  commodityId: string;
  batchNo: string;
  binId: string;
  qtyToPick: number;
  qtyPicked: number;
  status: 'Pending' | 'Completed';
}

export interface PackingSlip {
  id: string;
  packingNo: string;
  pickingId: string;
  soId: string;
  soNo: string;
  customerId: string;
  commodityId: string;
  batchNo: string;
  quantity: number;
  packageType: string;
  numPackages: number;
  weight: number;
  packingDate: string;
  status: 'Pending' | 'Completed';
}

export interface DeliveryChallan {
  id: string;
  dcNo: string;
  soId: string;
  soNo: string;
  customerId: string;
  warehouseId: string;
  vehicleNo: string;
  driverName: string;
  commodityId: string;
  quantity: number;
  deliveryAddress: string;
  dispatchDate: string;
  status: 'Draft' | 'Dispatched' | 'Delivered' | 'Cancelled';
}

export interface SalesInvoiceItem {
  commodityId: string;
  hsn: string;
  quantity: number;
  rate: number;
  discount: number;
  taxableAmount: number;
  cgst: number; // Amount
  sgst: number; // Amount
  igst: number; // Amount
  total: number;
}

export interface SalesInvoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  dcNo?: string;
  customerId: string;
  gstin: string;
  billingAddress: string;
  shippingAddress: string;
  items: SalesInvoiceItem[];
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  freight: number;
  otherCharges: number;
  grandTotal: number;
  dueDate: string;
  paymentStatus: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Overdue';
  ewayBillNo?: string;
}

export interface EWayBill {
  id: string;
  ewayBillNo: string;
  invoiceNo: string;
  customerId: string;
  partyName: string;
  vehicleNo: string;
  transporterName: string;
  mode: 'Road' | 'Rail' | 'Air' | 'Ship';
  distance: number;
  validFrom: string;
  validUntil: string;
  status: 'Active' | 'Expired' | 'Cancelled';
}

export interface POD {
  id: string;
  podNo: string;
  dcNo: string;
  invoiceNo?: string;
  customerId: string;
  customerName: string;
  vehicleNo: string;
  driverName: string;
  deliveryDate: string;
  deliveredQty: number;
  receivedBy: string;
  signatureUrl?: string; // Mock
  photoUrl?: string; // Mock
  status: 'Delivered' | 'Partially Delivered' | 'Rejected';
  remarks?: string;
}

// Finance Vouchers
export type VoucherType = 'Receipt' | 'Payment' | 'Contra' | 'Journal' | 'Expense' | 'Customer Advance' | 'Supplier Advance';

export interface Voucher {
  id: string;
  voucherNo: string;
  voucherType: VoucherType;
  date: string;
  referenceNo?: string;
  partyId?: string; // Customer, Supplier, Farmer or Employee
  partyType?: 'supplier' | 'farmer' | 'customer' | 'none';
  amount: number;
  paymentMode: 'Cash' | 'Bank Transfer' | 'Cheque' | 'UPI';
  cashBankLink: string; // e.g. "HDFC Bank A/c" or "Petty Cash"
  debitAccount: string;
  creditAccount: string;
  narration: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Cancelled';
  createdBy: string;
  approvedBy?: string;
}

export interface Expense {
  id: string;
  expenseNo: string;
  category: string; // Rent, Fuel, Wages, Office, Other
  vendor: string;
  amount: number;
  gstAmount: number;
  totalAmount: number;
  paymentMode: 'Cash' | 'Bank Transfer' | 'UPI';
  date: string;
  referenceNo?: string;
  attachmentUrl?: string;
  narration?: string;
}
