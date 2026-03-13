import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Clock, TrendingUp } from 'lucide-react-native';
import { api } from '../../lib/api';
import { colors, glass, typography } from '../../constants/theme';
import GlassCard from '../../components/GlassCard';
import StatusPill from '../../components/StatusPill';
import CurrencyText from '../../components/CurrencyText';

interface DashboardSummary {
  revenue: number;
  totalCosts: number;
  netProfit: number;
  activeJobsCount: number;
  pendingApprovalsCount: number;
  overdueInvoicesCount: number;
  overdueInvoicesTotal: number;
}

interface Job {
  id: string;
  name: string;
  customer: string;
  status: string;
  margin: number;
  value: number;
}

interface PendingApproval {
  id: string;
  type: string;
  description: string;
  requestedBy: string;
  amount?: number;
}

const FALLBACK_SUMMARY: DashboardSummary = {
  revenue: 48200,
  totalCosts: 31500,
  netProfit: 16700,
  activeJobsCount: 7,
  pendingApprovalsCount: 3,
  overdueInvoicesCount: 2,
  overdueInvoicesTotal: 5800,
};

const FALLBACK_JOBS: Job[] = [
  { id: '1', name: 'Henderson Exterior', customer: 'Mark Henderson', status: 'in_progress', margin: 34.2, value: 8400 },
  { id: '2', name: 'Downtown Office Suite', customer: 'Apex Realty', status: 'scheduled', margin: 28.5, value: 15200 },
  { id: '3', name: 'Riverside Condo Block A', customer: 'Sunrise Properties', status: 'in_progress', margin: 41.0, value: 22100 },
];

const FALLBACK_APPROVALS: PendingApproval[] = [
  { id: '1', type: 'Material Upgrade', description: 'Sherwin-Williams Emerald vs Duration', requestedBy: 'Jake Torres', amount: 640 },
  { id: '2', type: 'Scope Change', description: 'Add garage doors to Henderson job', requestedBy: 'Client', amount: 1200 },
  { id: '3', type: 'Expense', description: 'Scaffolding rental extension', requestedBy: 'Marcus Webb', amount: 380 },
];

function useDashboard() {
  return useQuery<DashboardSummary>({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get('/dashboard/summary').then((r) => r.data),
    placeholderData: FALLBACK_SUMMARY,
  });
}

function useActiveJobs() {
  return useQuery<Job[]>({
    queryKey: ['jobs', 'active'],
    queryFn: () => api.get('/jobs?status=active&limit=5').then((r) => r.data),
    placeholderData: FALLBACK_JOBS,
  });
}

function usePendingApprovals() {
  return useQuery<PendingApproval[]>({
    queryKey: ['approvals', 'pending'],
    queryFn: () => api.get('/approvals?status=pending').then((r) => r.data),
    placeholderData: FALLBACK_APPROVALS,
  });
}

function SummaryCards({ summary }: { summary: DashboardSummary }) {
  return (
    <View style={styles.summaryRow}>
      <GlassCard style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Revenue</Text>
        <CurrencyText amount={summary.revenue} style={styles.summaryValue} />
        <View style={styles.summaryIndicator}>
          <TrendingUp size={12} color={colors.success} strokeWidth={1.5} />
          <Text style={[styles.summaryChange, { color: colors.success }]}>+12.4%</Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Costs</Text>
        <CurrencyText amount={summary.totalCosts} style={styles.summaryValue} />
        <View style={styles.summaryIndicator}>
          <TrendingUp size={12} color={colors.warning} strokeWidth={1.5} />
          <Text style={[styles.summaryChange, { color: colors.warning }]}>+3.1%</Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Net Profit</Text>
        <CurrencyText
          amount={summary.netProfit}
          style={[styles.summaryValue, { color: colors.success }]}
        />
        <View style={styles.summaryIndicator}>
          <TrendingUp size={12} color={colors.success} strokeWidth={1.5} />
          <Text style={[styles.summaryChange, { color: colors.success }]}>+24.7%</Text>
        </View>
      </GlassCard>
    </View>
  );
}

function ActiveJobsList({ jobs }: { jobs: Job[] }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Active Jobs</Text>
        <Text style={styles.sectionCount}>{jobs.length}</Text>
      </View>
      {jobs.map((job) => (
        <GlassCard key={job.id} style={styles.jobCard}>
          <View style={styles.jobRow}>
            <View style={styles.jobInfo}>
              <Text style={styles.jobName} numberOfLines={1}>{job.name}</Text>
              <Text style={styles.jobCustomer}>{job.customer}</Text>
            </View>
            <View style={styles.jobMeta}>
              <StatusPill status={job.status} />
              <View style={styles.jobStats}>
                <CurrencyText amount={job.value} style={styles.jobValue} />
                <Text
                  style={[
                    styles.jobMargin,
                    { color: job.margin >= 35 ? colors.success : job.margin >= 25 ? colors.warning : colors.danger },
                  ]}
                >
                  {job.margin.toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
        </GlassCard>
      ))}
    </View>
  );
}

function PendingApprovalsCard({ approvals }: { approvals: PendingApproval[] }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Pending Approvals</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{approvals.length}</Text>
        </View>
      </View>
      <GlassCard>
        {approvals.map((approval, index) => (
          <View
            key={approval.id}
            style={[
              styles.approvalRow,
              index < approvals.length - 1 && styles.approvalBorder,
            ]}
          >
            <View style={styles.approvalInfo}>
              <Text style={styles.approvalType}>{approval.type}</Text>
              <Text style={styles.approvalDesc} numberOfLines={1}>{approval.description}</Text>
              <Text style={styles.approvalBy}>Requested by {approval.requestedBy}</Text>
            </View>
            <View style={styles.approvalActions}>
              {approval.amount !== undefined && (
                <CurrencyText amount={approval.amount} style={styles.approvalAmount} />
              )}
              <View style={styles.approvalButtons}>
                <TouchableOpacity style={[styles.approvalBtn, styles.approvalBtnDeny]}>
                  <Text style={[styles.approvalBtnText, { color: colors.danger }]}>Deny</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.approvalBtn, styles.approvalBtnApprove]}>
                  <Text style={[styles.approvalBtnText, { color: colors.success }]}>Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </GlassCard>
    </View>
  );
}

function OverdueInvoicesAlert({
  count,
  total,
}: {
  count: number;
  total: number;
}) {
  if (count === 0) return null;
  return (
    <View style={styles.section}>
      <GlassCard
        style={[
          styles.alertCard,
          { borderColor: colors.danger, backgroundColor: 'rgba(255,59,48,0.10)' },
        ]}
      >
        <View style={styles.alertRow}>
          <AlertCircle size={20} color={colors.danger} strokeWidth={1.5} />
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>
              {count} Overdue Invoice{count !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.alertSub}>
              <CurrencyText amount={total} style={styles.alertAmount} /> outstanding
            </Text>
          </View>
          <TouchableOpacity style={styles.alertAction}>
            <Text style={[styles.alertActionText, { color: colors.danger }]}>View</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>
    </View>
  );
}

export default function DashboardScreen() {
  const now = new Date();
  const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useDashboard();
  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useActiveJobs();
  const { data: approvals, refetch: refetchApprovals } = usePendingApprovals();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchSummary(), refetchJobs(), refetchApprovals()]);
    setRefreshing(false);
  }, [refetchSummary, refetchJobs, refetchApprovals]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <Text style={styles.headerSub}>{monthYear}</Text>
          </View>
          <View style={styles.headerRight}>
            <Clock size={16} color={colors.textSecondary} strokeWidth={1.5} />
            <Text style={styles.headerTime}>Live</Text>
          </View>
        </View>

        {summaryLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
        ) : summary ? (
          <>
            <SummaryCards summary={summary} />
            <OverdueInvoicesAlert
              count={summary.overdueInvoicesCount}
              total={summary.overdueInvoicesTotal}
            />
          </>
        ) : null}

        {!jobsLoading && jobs && <ActiveJobsList jobs={jobs} />}
        {approvals && <PendingApprovalsCard approvals={approvals} />}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  headerSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerTime: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'Menlo',
  },
  summaryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  summaryChange: {
    fontSize: 11,
    fontWeight: '500',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionCount: {
    fontSize: 13,
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  jobCard: {
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jobInfo: {
    flex: 1,
    marginRight: 12,
  },
  jobName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  jobCustomer: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  jobMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  jobStats: {
    alignItems: 'flex-end',
    gap: 1,
  },
  jobValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'Menlo',
  },
  jobMargin: {
    fontSize: 12,
    fontWeight: '500',
  },
  approvalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  approvalBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  approvalInfo: {
    flex: 1,
    marginRight: 10,
  },
  approvalType: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  approvalDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  approvalBy: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  approvalActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  approvalAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'Menlo',
  },
  approvalButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  approvalBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 28,
    justifyContent: 'center',
  },
  approvalBtnDeny: {
    borderColor: 'rgba(255,59,48,0.40)',
    backgroundColor: 'rgba(255,59,48,0.08)',
  },
  approvalBtnApprove: {
    borderColor: 'rgba(52,199,89,0.40)',
    backgroundColor: 'rgba(52,199,89,0.08)',
  },
  approvalBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  alertCard: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.danger,
    marginBottom: 2,
  },
  alertSub: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  alertAmount: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: 'Menlo',
  },
  alertAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.40)',
    backgroundColor: 'rgba(255,59,48,0.08)',
    minHeight: 32,
    justifyContent: 'center',
  },
  alertActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 100,
  },
});
