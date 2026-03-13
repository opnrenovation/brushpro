import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Target,
  Plus,
  ChevronRight,
  Phone,
  Mail,
  Calendar,
  FileText,
  X,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
} from 'lucide-react-native';
import { api } from '../../lib/api';
import { colors, glass, typography } from '../../constants/theme';
import GlassCard from '../../components/GlassCard';
import StatusPill from '../../components/StatusPill';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  stage: string;
  source: string;
  service_needed: string | null;
  project_address: string | null;
  message: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
  };
  appointment: {
    id: string;
    scheduled_at: string;
    status: string;
  } | null;
  estimate: {
    id: string;
    estimate_number: string;
    status: string;
  } | null;
}

// ─── Stage Config ────────────────────────────────────────────────────────────

const STAGES = [
  { key: 'ALL', label: 'All' },
  { key: 'NEW', label: 'New' },
  { key: 'CONTACTED', label: 'Contacted' },
  { key: 'APPOINTMENT', label: 'Appt.' },
  { key: 'ESTIMATE_SENT', label: 'Estimate' },
  { key: 'NEGOTIATING', label: 'Negotiating' },
  { key: 'WON', label: 'Won' },
  { key: 'LOST', label: 'Lost' },
] as const;

const STAGE_COLORS: Record<string, string> = {
  NEW: '#007AFF',
  CONTACTED: '#FF9500',
  APPOINTMENT: '#5856D6',
  ESTIMATE_SENT: '#007AFF',
  NEGOTIATING: '#FF9500',
  WON: '#34C759',
  LOST: '#FF3B30',
};

// ─── Fallback Data ───────────────────────────────────────────────────────────

const FALLBACK_LEADS: Lead[] = [
  {
    id: '1', stage: 'NEW', source: 'WEBSITE_FORM',
    service_needed: 'Residential Painting', project_address: '412 Oak St, Des Moines',
    message: 'Looking to repaint exterior of my home.', notes: null,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    contact: { id: '1', first_name: 'Sarah', last_name: 'Mitchell', email: 'sarah@example.com', phone: '(515) 555-0101' },
    appointment: null, estimate: null,
  },
  {
    id: '2', stage: 'APPOINTMENT', source: 'REFERRAL',
    service_needed: 'Interior Painting', project_address: '88 Maple Ave, Ankeny',
    message: null, notes: 'Referred by Henderson job',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    contact: { id: '2', first_name: 'Daniel', last_name: 'Park', email: 'dpark@example.com', phone: '(515) 555-0202' },
    appointment: { id: 'a1', scheduled_at: new Date(Date.now() + 86400000).toISOString(), status: 'SCHEDULED' },
    estimate: null,
  },
  {
    id: '3', stage: 'ESTIMATE_SENT', source: 'MANUAL',
    service_needed: 'Cabinet Painting', project_address: '3 Ridge Rd, Pleasant Hill',
    message: 'Kitchen + laundry cabinets.', notes: null,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    contact: { id: '3', first_name: 'Kim', last_name: 'Nguyen', email: 'kim@example.com', phone: '(515) 555-0303' },
    appointment: null,
    estimate: { id: 'e1', estimate_number: 'EST-0041', status: 'SENT' },
  },
  {
    id: '4', stage: 'WON', source: 'WEBSITE_FORM',
    service_needed: 'Exterior Painting', project_address: '22 Elm Dr, Altoona',
    message: null, notes: 'Converted — full exterior repaint',
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    contact: { id: '4', first_name: 'Tom', last_name: 'Eriksen', email: 'tom@example.com', phone: '(515) 555-0404' },
    appointment: null,
    estimate: { id: 'e2', estimate_number: 'EST-0039', status: 'APPROVED' },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    WEBSITE_FORM: 'Website',
    MANUAL: 'Manual',
    REFERRAL: 'Referral',
    PHONE: 'Phone',
    OTHER: 'Other',
  };
  return map[source] || source;
}

// ─── Lead Card ───────────────────────────────────────────────────────────────

function LeadCard({ lead, onPress }: { lead: Lead; onPress: () => void }) {
  const stageColor = STAGE_COLORS[lead.stage] || colors.textSecondary;
  const days = daysSince(lead.updated_at);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <GlassCard style={styles.leadCard}>
        <View style={styles.leadCardHeader}>
          <View style={styles.leadCardLeft}>
            <Text style={styles.leadName}>
              {lead.contact.first_name} {lead.contact.last_name}
            </Text>
            <Text style={styles.leadService} numberOfLines={1}>
              {lead.service_needed || 'General Inquiry'}
            </Text>
          </View>
          <View style={styles.leadCardRight}>
            <View style={[styles.stageDot, { backgroundColor: stageColor }]} />
            <Text style={[styles.stageLabel, { color: stageColor }]}>
              {lead.stage.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.leadCardFooter}>
          <View style={styles.sourceChip}>
            <Text style={styles.sourceText}>{sourceLabel(lead.source)}</Text>
          </View>
          <Text style={styles.daysText}>
            {days === 0 ? 'Today' : `${days}d in stage`}
          </Text>
        </View>

        {lead.estimate && (
          <View style={styles.linkedItem}>
            <FileText size={12} color={colors.primary} strokeWidth={1.5} />
            <Text style={styles.linkedText}>{lead.estimate.estimate_number}</Text>
            <StatusPill status={lead.estimate.status} />
          </View>
        )}

        {lead.appointment && (
          <View style={styles.linkedItem}>
            <Calendar size={12} color={colors.warning} strokeWidth={1.5} />
            <Text style={styles.linkedText}>
              Appt: {new Date(lead.appointment.scheduled_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </Text>
          </View>
        )}
      </GlassCard>
    </TouchableOpacity>
  );
}

// ─── Lead Detail Modal ────────────────────────────────────────────────────────

function LeadDetailModal({
  lead,
  visible,
  onClose,
  onStageChange,
}: {
  lead: Lead | null;
  visible: boolean;
  onClose: () => void;
  onStageChange: (id: string, stage: string) => void;
}) {
  const [showStageSelector, setShowStageSelector] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [pendingStage, setPendingStage] = useState('');

  if (!lead) return null;

  const stageColor = STAGE_COLORS[lead.stage] || colors.textSecondary;
  const allStages = ['NEW', 'CONTACTED', 'APPOINTMENT', 'ESTIMATE_SENT', 'NEGOTIATING', 'WON', 'LOST'];

  const handleStageSelect = (stage: string) => {
    if (stage === 'LOST') {
      setPendingStage(stage);
    } else {
      onStageChange(lead.id, stage);
      setShowStageSelector(false);
    }
  };

  const confirmLost = () => {
    if (lostReason.trim()) {
      onStageChange(lead.id, 'LOST');
      setLostReason('');
      setPendingStage('');
      setShowStageSelector(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>
              {lead.contact.first_name} {lead.contact.last_name}
            </Text>
            <Text style={styles.modalSubtitle}>{lead.service_needed || 'General Inquiry'}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <X size={20} color={colors.textSecondary} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
          {/* Contact Info */}
          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <Text style={styles.contactName}>
              {lead.contact.first_name} {lead.contact.last_name}
            </Text>
            <Text style={styles.contactEmail}>{lead.contact.email}</Text>
            {lead.contact.phone && (
              <View style={styles.contactActions}>
                <TouchableOpacity style={styles.contactBtn}>
                  <Phone size={16} color={colors.primary} strokeWidth={1.5} />
                  <Text style={styles.contactBtnText}>{lead.contact.phone}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactBtn}>
                  <Mail size={16} color={colors.primary} strokeWidth={1.5} />
                  <Text style={styles.contactBtnText}>Email</Text>
                </TouchableOpacity>
              </View>
            )}
          </GlassCard>

          {/* Lead Details */}
          {(lead.project_address || lead.message) && (
            <GlassCard style={styles.section}>
              <Text style={styles.sectionTitle}>Details</Text>
              {lead.project_address && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Address</Text>
                  <Text style={styles.detailValue}>{lead.project_address}</Text>
                </View>
              )}
              {lead.message && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Message</Text>
                  <Text style={styles.detailValue}>{lead.message}</Text>
                </View>
              )}
            </GlassCard>
          )}

          {/* Stage */}
          <GlassCard style={styles.section}>
            <View style={styles.stageSectionHeader}>
              <Text style={styles.sectionTitle}>Stage</Text>
              <TouchableOpacity
                style={styles.changeStageBtn}
                onPress={() => setShowStageSelector(!showStageSelector)}
              >
                <Text style={styles.changeStageBtnText}>Change</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.currentStage}>
              <View style={[styles.stageDot, { backgroundColor: stageColor, width: 10, height: 10 }]} />
              <Text style={[styles.currentStageText, { color: stageColor }]}>
                {lead.stage.replace(/_/g, ' ')}
              </Text>
            </View>

            {showStageSelector && (
              <View style={styles.stageGrid}>
                {allStages.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.stageChip,
                      lead.stage === s && styles.stageChipActive,
                      { borderColor: STAGE_COLORS[s] + '50' },
                    ]}
                    onPress={() => handleStageSelect(s)}
                  >
                    <Text style={[styles.stageChipText, { color: STAGE_COLORS[s] }]}>
                      {s.replace(/_/g, ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {pendingStage === 'LOST' && (
              <View style={styles.lostReasonContainer}>
                <Text style={styles.lostReasonLabel}>Reason for loss (required)</Text>
                <TextInput
                  style={styles.lostReasonInput}
                  value={lostReason}
                  onChangeText={setLostReason}
                  placeholder="e.g. Price too high, chose competitor..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.confirmLostBtn, !lostReason.trim() && { opacity: 0.4 }]}
                  onPress={confirmLost}
                  disabled={!lostReason.trim()}
                >
                  <Text style={styles.confirmLostText}>Mark as Lost</Text>
                </TouchableOpacity>
              </View>
            )}
          </GlassCard>

          {/* Linked Estimate */}
          {lead.estimate && (
            <GlassCard style={styles.section}>
              <Text style={styles.sectionTitle}>Estimate</Text>
              <View style={styles.linkedCard}>
                <FileText size={16} color={colors.primary} strokeWidth={1.5} />
                <View style={styles.linkedCardInfo}>
                  <Text style={styles.linkedCardTitle}>{lead.estimate.estimate_number}</Text>
                </View>
                <StatusPill status={lead.estimate.status} />
              </View>
            </GlassCard>
          )}

          {/* Linked Appointment */}
          {lead.appointment && (
            <GlassCard style={styles.section}>
              <Text style={styles.sectionTitle}>Appointment</Text>
              <View style={styles.linkedCard}>
                <Calendar size={16} color={colors.warning} strokeWidth={1.5} />
                <View style={styles.linkedCardInfo}>
                  <Text style={styles.linkedCardTitle}>
                    {new Date(lead.appointment.scheduled_at).toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                    })}
                  </Text>
                  <Text style={styles.linkedCardSub}>
                    {new Date(lead.appointment.scheduled_at).toLocaleTimeString('en-US', {
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </Text>
                </View>
                <StatusPill status={lead.appointment.status} />
              </View>
            </GlassCard>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LeadsScreen() {
  const [activeStage, setActiveStage] = useState<string>('ALL');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: leads = FALLBACK_LEADS, refetch } = useQuery<Lead[]>({
    queryKey: ['leads'],
    queryFn: () => api.get('/leads').then((r) => r.data.data || r.data),
    placeholderData: FALLBACK_LEADS,
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      api.patch(`/leads/${id}`, { stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSelectedLead(null);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Filter
  const filtered = leads.filter((lead) => {
    const matchesStage = activeStage === 'ALL' || lead.stage === activeStage;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      `${lead.contact.first_name} ${lead.contact.last_name}`.toLowerCase().includes(q) ||
      lead.service_needed?.toLowerCase().includes(q) ||
      lead.contact.email.toLowerCase().includes(q);
    return matchesStage && matchesSearch;
  });

  // Stats
  const total = leads.length;
  const won = leads.filter((l) => l.stage === 'WON').length;
  const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
  const newLeads = leads.filter((l) => l.stage === 'NEW').length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Target size={22} color={colors.primary} strokeWidth={1.5} />
          <Text style={styles.headerTitle}>Leads</Text>
        </View>
        <TouchableOpacity style={styles.addBtn}>
          <Plus size={18} color={colors.primary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statValue}>{total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </GlassCard>
        <GlassCard style={styles.statCard}>
          <View style={styles.statWithIcon}>
            {newLeads > 0 ? (
              <TrendingUp size={14} color={colors.primary} strokeWidth={1.5} />
            ) : null}
            <Text style={[styles.statValue, newLeads > 0 && { color: colors.primary }]}>
              {newLeads}
            </Text>
          </View>
          <Text style={styles.statLabel}>New</Text>
        </GlassCard>
        <GlassCard style={styles.statCard}>
          <View style={styles.statWithIcon}>
            {winRate >= 50 ? (
              <TrendingUp size={14} color={colors.success} strokeWidth={1.5} />
            ) : (
              <TrendingDown size={14} color={colors.warning} strokeWidth={1.5} />
            )}
            <Text style={[styles.statValue, { color: winRate >= 50 ? colors.success : colors.warning }]}>
              {winRate}%
            </Text>
          </View>
          <Text style={styles.statLabel}>Win Rate</Text>
        </GlassCard>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={16} color={colors.textTertiary} strokeWidth={1.5} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search leads..."
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      {/* Stage Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stageTabs}
      >
        {STAGES.map((stage) => {
          const count = stage.key === 'ALL'
            ? leads.length
            : leads.filter((l) => l.stage === stage.key).length;
          const isActive = activeStage === stage.key;
          return (
            <TouchableOpacity
              key={stage.key}
              style={[styles.stageTab, isActive && styles.stageTabActive]}
              onPress={() => setActiveStage(stage.key)}
            >
              <Text style={[styles.stageTabText, isActive && styles.stageTabTextActive]}>
                {stage.label}
              </Text>
              {count > 0 && (
                <View style={[styles.stageTabBadge, isActive && styles.stageTabBadgeActive]}>
                  <Text style={[styles.stageTabBadgeText, isActive && styles.stageTabBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Lead List */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Target size={40} color={colors.textTertiary} strokeWidth={1} />
            <Text style={styles.emptyText}>No leads found</Text>
            <Text style={styles.emptySubText}>
              {activeStage === 'ALL'
                ? 'New leads from your website will appear here.'
                : `No leads in ${activeStage.replace(/_/g, ' ')} stage.`}
            </Text>
          </View>
        ) : (
          filtered.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onPress={() => setSelectedLead(lead)}
            />
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Lead Detail Modal */}
      <LeadDetailModal
        lead={selectedLead}
        visible={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        onStageChange={(id, stage) => stageMutation.mutate({ id, stage })}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { ...typography.title, color: colors.textPrimary },
  addBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(0,122,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(0,122,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'Menlo',
  },
  statLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    height: '100%',
  },

  stageTabs: {
    paddingHorizontal: 16,
    gap: 6,
    paddingBottom: 12,
  },
  stageTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 32,
  },
  stageTabActive: {
    backgroundColor: 'rgba(0,122,255,0.15)',
    borderColor: 'rgba(0,122,255,0.3)',
  },
  stageTabText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  stageTabTextActive: { color: colors.primary },
  stageTabBadge: {
    backgroundColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  stageTabBadgeActive: { backgroundColor: 'rgba(0,122,255,0.2)' },
  stageTabBadgeText: { fontSize: 10, color: colors.textTertiary, fontWeight: '600' },
  stageTabBadgeTextActive: { color: colors.primary },

  scroll: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },

  leadCard: { marginBottom: 10, paddingHorizontal: 14, paddingVertical: 12 },
  leadCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  leadCardLeft: { flex: 1, marginRight: 10 },
  leadName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 3 },
  leadService: { fontSize: 13, color: colors.textSecondary },
  leadCardRight: { alignItems: 'flex-end', gap: 4 },
  stageDot: { width: 7, height: 7, borderRadius: 4 },
  stageLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  leadCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sourceChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  sourceText: { fontSize: 11, color: colors.textTertiary },
  daysText: { fontSize: 12, color: colors.textTertiary },
  linkedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  linkedText: { fontSize: 12, color: colors.textSecondary, flex: 1 },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  emptySubText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', maxWidth: 280 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: colors.textSecondary },
  modalClose: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  modalScroll: { flex: 1, padding: 16 },

  section: { marginBottom: 12, paddingHorizontal: 14, paddingVertical: 14 },
  sectionTitle: {
    fontSize: 11, fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 10,
  },
  contactName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  contactEmail: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  contactActions: { flexDirection: 'row', gap: 8 },
  contactBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(0,122,255,0.2)',
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    justifyContent: 'center', minHeight: 44,
  },
  contactBtnText: { fontSize: 13, color: colors.primary, fontWeight: '500' },

  detailRow: { marginBottom: 10 },
  detailLabel: { fontSize: 11, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  detailValue: { fontSize: 14, color: colors.textPrimary },

  stageSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  changeStageBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(0,122,255,0.2)',
    borderRadius: 8,
  },
  changeStageBtnText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  currentStage: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currentStageText: { fontSize: 15, fontWeight: '600' },
  stageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  stageChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
    backgroundColor: colors.surface,
  },
  stageChipActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  stageChipText: { fontSize: 12, fontWeight: '600' },
  lostReasonContainer: { marginTop: 12 },
  lostReasonLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  lostReasonInput: {
    ...glass,
    color: colors.textPrimary, fontSize: 14,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, minHeight: 80,
    textAlignVertical: 'top', marginBottom: 10,
  },
  confirmLostBtn: {
    backgroundColor: colors.danger,
    borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', minHeight: 44,
  },
  confirmLostText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  linkedCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkedCardInfo: { flex: 1 },
  linkedCardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  linkedCardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
});
