import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Plus, List, LayoutGrid, X, FileText, DollarSign, Package } from 'lucide-react-native';
import { api } from '../../lib/api';
import { colors, glass, typography } from '../../constants/theme';
import GlassCard from '../../components/GlassCard';
import StatusPill from '../../components/StatusPill';
import CurrencyText from '../../components/CurrencyText';

interface Job {
  id: string;
  name: string;
  customer: string;
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'invoiced' | 'paid';
  margin: number;
  value: number;
  startDate: string;
  address: string;
}

const KANBAN_COLUMNS = [
  { key: 'draft', label: 'Draft' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'invoiced', label: 'Invoiced' },
  { key: 'paid', label: 'Paid' },
];

const FALLBACK_JOBS: Job[] = [
  { id: '1', name: 'Henderson Exterior', customer: 'Mark Henderson', status: 'in_progress', margin: 34.2, value: 8400, startDate: '2026-03-05', address: '142 Maple Ave' },
  { id: '2', name: 'Downtown Office Suite', customer: 'Apex Realty', status: 'scheduled', margin: 28.5, value: 15200, startDate: '2026-03-18', address: '800 Commerce Blvd #400' },
  { id: '3', name: 'Riverside Condo Block A', customer: 'Sunrise Properties', status: 'in_progress', margin: 41.0, value: 22100, startDate: '2026-02-28', address: '12 Riverside Dr' },
  { id: '4', name: 'Garcia Residence Interior', customer: 'Elena Garcia', status: 'completed', margin: 38.7, value: 5600, startDate: '2026-02-15', address: '55 Birchwood Ct' },
  { id: '5', name: 'Lakeview Cabin', customer: 'Tom Eriksen', status: 'invoiced', margin: 31.2, value: 3800, startDate: '2026-02-10', address: '9 Lakeview Rd' },
  { id: '6', name: 'Northside Warehouse', customer: 'MidWest Storage LLC', status: 'draft', margin: 22.4, value: 11000, startDate: '2026-04-01', address: '300 Industrial Pkwy' },
];

function useJobs() {
  return useQuery<Job[]>({
    queryKey: ['jobs', 'all'],
    queryFn: () => api.get('/jobs').then((r) => r.data),
    placeholderData: FALLBACK_JOBS,
  });
}

function JobListItem({ job }: { job: Job }) {
  return (
    <GlassCard style={styles.jobCard}>
      <View style={styles.jobHeader}>
        <View style={styles.jobHeaderLeft}>
          <Text style={styles.jobName} numberOfLines={1}>{job.name}</Text>
          <Text style={styles.jobCustomer}>{job.customer}</Text>
        </View>
        <StatusPill status={job.status} />
      </View>
      <View style={styles.jobFooter}>
        <Text style={styles.jobAddress} numberOfLines={1}>{job.address}</Text>
        <View style={styles.jobNumbers}>
          <CurrencyText amount={job.value} style={styles.jobValue} />
          <Text
            style={[
              styles.jobMargin,
              {
                color:
                  job.margin >= 35
                    ? colors.success
                    : job.margin >= 25
                    ? colors.warning
                    : colors.danger,
              },
            ]}
          >
            {job.margin.toFixed(1)}% margin
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}

function KanbanView({ jobs }: { jobs: Job[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.kanbanContainer}
    >
      {KANBAN_COLUMNS.map((col) => {
        const colJobs = jobs.filter((j) => j.status === col.key);
        return (
          <View key={col.key} style={styles.kanbanColumn}>
            <View style={styles.kanbanColHeader}>
              <Text style={styles.kanbanColTitle}>{col.label}</Text>
              <Text style={styles.kanbanColCount}>{colJobs.length}</Text>
            </View>
            {colJobs.length === 0 ? (
              <View style={styles.kanbanEmpty}>
                <Text style={styles.kanbanEmptyText}>No jobs</Text>
              </View>
            ) : (
              colJobs.map((job) => (
                <GlassCard key={job.id} style={styles.kanbanCard}>
                  <Text style={styles.kanbanJobName} numberOfLines={2}>{job.name}</Text>
                  <Text style={styles.kanbanCustomer}>{job.customer}</Text>
                  <View style={styles.kanbanFooter}>
                    <CurrencyText amount={job.value} style={styles.kanbanValue} />
                    <Text
                      style={[
                        styles.kanbanMargin,
                        {
                          color:
                            job.margin >= 35
                              ? colors.success
                              : job.margin >= 25
                              ? colors.warning
                              : colors.danger,
                        },
                      ]}
                    >
                      {job.margin.toFixed(1)}%
                    </Text>
                  </View>
                </GlassCard>
              ))
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function FABMenu({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const actions = [
    { icon: FileText, label: 'New Job', color: colors.primary },
    { icon: DollarSign, label: 'New Invoice', color: colors.success },
    { icon: Package, label: 'Log Expense', color: colors.warning },
  ];

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.fabOverlay} onPress={onClose}>
        <View style={styles.fabMenu}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.fabMenuItem}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <View style={[styles.fabMenuIcon, { backgroundColor: `${action.color}20`, borderColor: `${action.color}40` }]}>
                <action.icon size={18} color={action.color} strokeWidth={1.5} />
              </View>
              <Text style={styles.fabMenuLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

export default function JobsScreen() {
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [fabOpen, setFabOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: jobs = [], refetch } = useJobs();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Jobs</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
            onPress={() => setViewMode('list')}
            activeOpacity={0.7}
          >
            <List size={16} color={viewMode === 'list' ? colors.primary : colors.textSecondary} strokeWidth={1.5} />
            <Text
              style={[styles.toggleLabel, viewMode === 'list' && styles.toggleLabelActive]}
            >
              List
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'kanban' && styles.toggleBtnActive]}
            onPress={() => setViewMode('kanban')}
            activeOpacity={0.7}
          >
            <LayoutGrid size={16} color={viewMode === 'kanban' ? colors.primary : colors.textSecondary} strokeWidth={1.5} />
            <Text
              style={[styles.toggleLabel, viewMode === 'kanban' && styles.toggleLabelActive]}
            >
              Kanban
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'list' ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {jobs.map((job) => (
            <JobListItem key={job.id} job={job} />
          ))}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      ) : (
        <KanbanView jobs={jobs} />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setFabOpen(true)}
        activeOpacity={0.85}
      >
        <Plus size={24} color="#FFFFFF" strokeWidth={2} />
      </TouchableOpacity>

      <FABMenu visible={fabOpen} onClose={() => setFabOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 3,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    minHeight: 32,
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(0,122,255,0.15)',
  },
  toggleLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  toggleLabelActive: {
    color: colors.primary,
  },
  scroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  jobCard: {
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  jobHeaderLeft: {
    flex: 1,
    marginRight: 10,
  },
  jobName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  jobCustomer: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  jobFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jobAddress: {
    fontSize: 12,
    color: colors.textTertiary,
    flex: 1,
    marginRight: 8,
  },
  jobNumbers: {
    alignItems: 'flex-end',
  },
  jobValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'Menlo',
  },
  jobMargin: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  kanbanContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 10,
    paddingBottom: 100,
  },
  kanbanColumn: {
    width: 220,
  },
  kanbanColHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  kanbanColTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kanbanColCount: {
    fontSize: 12,
    color: colors.textTertiary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  kanbanEmpty: {
    ...glass,
    padding: 16,
    alignItems: 'center',
  },
  kanbanEmptyText: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  kanbanCard: {
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  kanbanJobName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  kanbanCustomer: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  kanbanFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kanbanValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'Menlo',
  },
  kanbanMargin: {
    fontSize: 12,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingRight: 20,
    paddingBottom: 170,
  },
  fabMenu: {
    ...glass,
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 2,
    minWidth: 180,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 44,
  },
  fabMenuIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabMenuLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  bottomSpacer: {
    height: 100,
  },
});
