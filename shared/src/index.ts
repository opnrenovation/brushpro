// Enums
export type UserRole = 'OWNER' | 'ADMIN';
export type ContactType = 'PROSPECT' | 'CUSTOMER' | 'BOTH';
export type JobStatus = 'ESTIMATING' | 'ACTIVE' | 'INVOICED' | 'COMPLETE' | 'CANCELLED';
export type EstimateStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'VOID';
export type InvoiceType = 'DEPOSIT' | 'PROGRESS' | 'FINAL';
export type ContractStatus = 'PENDING' | 'SIGNED' | 'DECLINED';
export type PaymentMethod = 'CARD' | 'CHECK' | 'CASH' | 'TRANSFER';
export type ExpenseCategory = 'MATERIALS' | 'SUBCONTRACTOR' | 'EQUIPMENT_RENTAL' | 'SUPPLIES' | 'OTHER';
export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'CANCELLED';
export type CampaignEventType = 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'BOUNCED' | 'UNSUBSCRIBED' | 'COMPLAINED';
export type ImportType = 'CONTACTS' | 'CUSTOMERS';
export type ExemptionType = 'STATE_EXEMPT' | 'LOCAL_EXEMPT' | 'FULLY_EXEMPT';

// Line item structure (stored as JSON in estimates and invoices)
export interface LineItem {
  id: string;
  description: string;
  type: 'labor' | 'material' | 'other';
  qty: number;
  unit: string;
  unit_price: number;
  our_cost: number; // INTERNAL — never shown to customers
  material_item_id: string | null;
  taxable: boolean;
  exempt_reason: string | null;
}

// API response wrapper
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

// Auth
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

// Company Settings
export interface CompanySettings {
  id: string;
  company_name: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  license_number?: string;
  default_labor_rate?: number;
  default_tax_profile_id?: string;
  invoice_prefix: string;
  estimate_prefix: string;
  invoice_notes?: string;
  estimate_notes?: string;
  contract_template?: string;
  updated_at: string;
}

// Contact
export interface Contact {
  id: string;
  type: ContactType;
  first_name: string;
  last_name: string;
  company?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  tags: string[];
  source?: string;
  notes?: string;
  customer_id?: string;
  subscribed: boolean;
  resend_contact_id?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

// Contact List
export interface ContactList {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  member_count?: number;
  subscribed_count?: number;
}

// Customer
export interface Customer {
  id: string;
  contact_id?: string;
  name: string;
  email?: string;
  phone?: string;
  address: string;
  notes?: string;
  deleted_at?: string;
  created_at: string;
}

// Job
export interface Job {
  id: string;
  customer_id: string;
  name: string;
  address: string;
  municipality: string;
  status: JobStatus;
  start_date?: string;
  end_date?: string;
  labor_rate: number;
  notes?: string;
  deleted_at?: string;
  updated_at: string;
  created_at: string;
  customer?: Customer;
}

// Material Item (Price Book)
export interface MaterialItem {
  id: string;
  name: string;
  sku?: string;
  vendor?: string;
  category: string;
  unit: string;
  our_cost: number;
  is_active: boolean;
  notes?: string;
  updated_at: string;
  created_at: string;
}

// Estimate
export interface Estimate {
  id: string;
  job_id: string;
  estimate_number: string;
  status: EstimateStatus;
  line_items: LineItem[];
  tax_profile_id: string;
  notes?: string;
  approval_token?: string;
  approval_token_expires_at?: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_note?: string;
  sent_at?: string;
  deleted_at?: string;
  created_at: string;
}

// Contract
export interface Contract {
  id: string;
  estimate_id: string;
  job_id: string;
  body_text: string;
  status: ContractStatus;
  customer_name_signed?: string;
  signature_url?: string;
  ip_address?: string;
  signed_at?: string;
  pdf_url?: string;
  created_at: string;
}

// Invoice
export interface Invoice {
  id: string;
  job_id: string;
  estimate_id?: string;
  invoice_number: string;
  type: InvoiceType;
  status: InvoiceStatus;
  line_items: LineItem[];
  tax_profile_id: string;
  due_date: string;
  notes?: string;
  pdf_url?: string;
  sent_at?: string;
  deleted_at?: string;
  updated_at: string;
  created_at: string;
}

// Tax Profile
export interface TaxProfile {
  id: string;
  name: string;
  state_code: string;
  state_rate: number;
  local_rate: number;
  municipality: string;
  taxable_labor: boolean;
  is_default: boolean;
  created_at: string;
}

// Payment
export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  method: PaymentMethod;
  stripe_id?: string;
  paid_at: string;
  notes?: string;
  created_at: string;
}

// Labor Entry
export interface LaborEntry {
  id: string;
  job_id: string;
  user_id: string;
  description: string;
  hours: number;
  rate: number;
  work_date: string;
  created_at: string;
}

// Expense
export interface Expense {
  id: string;
  job_id: string;
  vendor: string;
  description: string;
  amount: number;
  expense_date: string;
  category: ExpenseCategory;
  receipt_url?: string;
  notes?: string;
  created_at: string;
}

// Email Template
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  preview_text?: string;
  thumbnail_url?: string;
  created_by: string;
  updated_at: string;
  created_at: string;
}

// Campaign
export interface Campaign {
  id: string;
  name: string;
  subject: string;
  preview_text?: string;
  html_body: string;
  template_id?: string;
  list_ids: string[];
  status: CampaignStatus;
  scheduled_at?: string;
  sent_at?: string;
  total_recipients: number;
  resend_broadcast_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Campaign Event
export interface CampaignEvent {
  id: string;
  campaign_id: string;
  contact_id: string;
  event_type: CampaignEventType;
  resend_msg_id?: string;
  link_url?: string;
  occurred_at: string;
}

// CSV Import
export interface CsvImport {
  id: string;
  import_type: ImportType;
  filename: string;
  total_rows: number;
  imported: number;
  skipped: number;
  errors: number;
  error_log?: { row: number; reason: string }[];
  imported_by: string;
  created_at: string;
}

// Profitability
export interface JobProfitability {
  job_id: string;
  revenue: number;
  labor_cost: number;
  expense_cost: number;
  material_cost: number;
  total_cost: number;
  gross_profit: number;
  margin_percent: number;
}
