import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  Receipt,
  TrendingUp,
  Package,
  Download,
  ChevronDown,
  Clock,
  DollarSign,
} from 'lucide-react-native';
import { api } from '../../lib/api';
import { colors, glass, typography } from '../../constants/theme';
import GlassCard from '../../components/GlassCard';
import CurrencyText from '../../components/CurrencyText';

interface TaxReport {
  period: string;
  taxCollected: number;
  taxableRevenue: number;
  taxRate: number;
  breakdown: { label: string; amount: number }[];
}

interface JobProfitReport {
  jobs: {
    id: string;
    name: string;
    customer: string;
    revenue: number;
    costs: number;
    profit: number;
    margin: number;
  }[];
  totals: {
    revenue: number;
    costs: number;
    profit: number;
    avgMargin: number;
  };
}

interface MaterialsHoursReport {
  materials: { category: string; amount: number; percentage: number }[];
  hours: { role: string; hours: number; cost: number }[];
  totalMaterials: number;
  totalLaborCost: number;
  totalHours: number;
}

const FALLBACK_TAX: TaxReport = {
  period: 'Q1 2026',
  taxCollected: 4320,
  taxableRevenue: 48200,
  taxRate: 8.97,
  breakdown: [
    { label: 'State Tax (6.5%)', amount: 3133 },
    { label: 'County Tax (1.5%)', amount: 723 },
    { label: 'City Tax (0.97%)', amount: 467 },
  ],
};

const FALLBACK_JOB_PROFIT: JobProfitReport = {
  jobs: [
    { id: '1', name: 'Henderson Exterior', customer: 'Mark Henderson', revenue: 8400, costs: 5528, profit: 2872, margin: 34.2 },
    { id: '2', name: 'Riverside Condo Block A', customer: 'Sunrise Properties', revenue: 22100, costs: 13039, profit: 9061, margin: 41.0 },
    { id: '3', name: 'Garcia Residence Interior', customer: 'Elena Garcia', revenue: 5600, costs: 3432, profit: 2168, margin: 38.7 },
    { id: '4', name: 'Lakeview Cabin', customer: 'Tom Eriksen', revenue: 3800, costs: 2615, profit: 1185, margin: 31.2 },
    { id: '5', name: 'Northside Warehouse', customer: 'MidWest Storage', revenue: 8300, costs: 6446, profit: 1854, margin: 22.4 },
  ],
  totals: { revenue: 48200, costs: 31060, profit: 17140, avgMargin: 35.5 },
};

const FALLBACK_MATERIALS: MaterialsHoursReport = {
  materials: [
    { category: 'Paint & Primers', amount: 8200, percentage: 42 },
    { category: 'Prep Supplies', amount: 3100, percentage: 16 },
    { category: 'Equipment Rental', amount: 2800, percentage: 14 },
    { category: 'Safety Gear', amount: 1200, percentage: 6 },
    { category: 'Other Materials', amount: 4300, percentage: 22 },
  ],
  hours: [
    { role: 'Lead Painter', hours: 124, cost: 3720 },
    { role: 'Painter', hours: 286, cost: 6864 },
    { role: 'Prep Worker', hours: 95, cost: 1900 },
  ],
  totalMaterials: 19600,
  totalLaborCost: 12484,
  totalHours: 505,
};

function useTaxReport() {
  return useQuery<TaxReport>({
    queryKey: ['reports', 'tax'],
    queryFn: () => api.get('/reports/tax').then((r) => r.data),
    placeholderData: FALLBACK_TAX,
  });
}

function useJobProfitReport() {
  return useQuery<JobProfitReport>({
    queryKey: ['reports', 'job-profit'],
    queryFn: () => api.get('/reports/job-profit').then((r) => r.data),
    placeholderData: FALLBACK_JOB_PROFIT,
  });
}

function useMaterialsHoursReport() {
  return useQuery<MaterialsHoursReport>({
    queryKey: ['reports', 'materials-hours'],
    queryFn: () => api.get('/reports/materials-hours').then((r) => r.data),
    placeholderData: FALLBACK_MATERIALS,
  });
}

function ExportButton({ label }: { label: string }) {
  return (
    <TouchableOpacity style={styles.exportBtn} activeOpacity={0.7}>
      <Download size={14} color={colors.primary} strokeWidth={1.5} />
      <Text style={styles.exportBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function TaxReportCard() {
  const { data: tax } = useTaxReport();
  const [expanded, setExpanded] = useState(false);

  if (!tax) return null;

  return (
    <GlassCard style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <View style={styles.reportIconWrap}>
          <Receipt size={18} color={colors.warning} strokeWidth={1.5} />
        </View>
        <View style={styles.reportTitleBlock}>
          <Text style={styles.reportTitle}>Tax Collected</Text>
          <Text style={styles.reportPeriod}>{tax.period}</Text>
        </View>
        <ExportButton label="CSV" />
      </View>

      <View style={styles.reportMainStat}>
        <CurrencyText amount={tax.taxCollected} style={styles.reportMainValue} />
        <Text style={styles.reportMainLabel}>Total Tax Collected</Text>
      </View>

      <View style={styles.reportRow}>
        <View style={styles.reportItem}>
          <Text style={styles.reportItemLabel}>Taxable Revenue</Text>
          <CurrencyText amount={tax.taxableRevenue} style={styles.reportItemValue} />
        </View>
        <View style={styles.reportItem}>
          <Text style={styles.reportItemLabel}>Effective Rate</Text>
          <Text style={[styles.reportItemValue, { fontFamily: 'Menlo' }]}>
            {tax.taxRate.toFixed(2)}%
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.expandToggle}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.expandToggleText}>Tax Breakdown</Text>
        <ChevronDown
          size={14}
          color={colors.textSecondary}
          strokeWidth={1.5}
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.breakdown}>
          {tax.breakdown.map((item) => (
            <View key={item.label} style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{item.label}</Text>
              <CurrencyText amount={item.amount} style={styles.breakdownValue} />
            </View>
          ))}
        </View>
      )}
    </GlassCard>
  );
}

function JobProfitCard() {
  const { data: report } = useJobProfitReport();
  const [expanded, setExpanded] = useState(false);

  if (!report) return null;

  return (
    <GlassCard style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <View style={styles.reportIconWrap}>
          <TrendingUp size={18} color={colors.success} strokeWidth={1.5} />
        </View>
        <View style={styles.reportTitleBlock}>
          <Text style={styles.reportTitle}>Profit Per Job</Text>
          <Text style={styles.reportPeriod}>Current Period</Text>
        </View>
        <ExportButton label="CSV" />
      </View>

      <View style={styles.reportRow}>
        <View style={styles.reportItem}>
          <Text style={styles.reportItemLabel}>Total Revenue</Text>
          <CurrencyText amount={report.totals.revenue} style={styles.reportItemValue} />
        </View>
        <View style={styles.reportItem}>
          <Text style={styles.reportItemLabel}>Total Costs</Text>
          <CurrencyText amount={report.totals.costs} style={styles.reportItemValue} />
        </View>
        <View style={styles.reportItem}>
          <Text style={styles.reportItemLabel}>Net Profit</Text>
          <CurrencyText amount={report.totals.profit} style={[styles.reportItemValue, { color: colors.success }]} />
        </View>
      </View>

      <View style={styles.avgMarginRow}>
        <Text style={styles.avgMarginLabel}>Avg Margin</Text>
        <Text
          style={[
            styles.avgMarginValue,
            {
              color:
                report.totals.avgMargin >= 35
                  ? colors.success
                  : report.totals.avgMargin >= 25
                  ? colors.warning
                  : colors.danger,
            },
          ]}
        >
          {report.totals.avgMargin.toFixed(1)}%
        </Text>
      </View>

      <TouchableOpacity
        style={styles.expandToggle}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.expandToggleText}>Per-Job Details ({report.jobs.length})</Text>
        <ChevronDown
          size={14}
          color={colors.textSecondary}
          strokeWidth={1.5}
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.breakdown}>
          {report.jobs.map((job) => (
            <View key={job.id} style={styles.jobProfitRow}>
              <View style={styles.jobProfitInfo}>
                <Text style={styles.jobProfitName} numberOfLines={1}>{job.name}</Text>
                <Text style={styles.jobProfitCustomer}>{job.customer}</Text>
              </View>
              <View style={styles.jobProfitNumbers}>
                <CurrencyText amount={job.profit} style={styles.jobProfitValue} />
                <Text
                  style={[
                    styles.jobProfitMargin,
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
            </View>
          ))}
        </View>
      )}
    </GlassCard>
  );
}

function MaterialsHoursCard() {
  const { data: report } = useMaterialsHoursReport();
  const [expanded, setExpanded] = useState(false);

  if (!report) return null;

  return (
    <GlassCard style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <View style={styles.reportIconWrap}>
          <Package size={18} color={colors.primary} strokeWidth={1.5} />
        </View>
        <View style={styles.reportTitleBlock}>
          <Text style={styles.reportTitle}>Materials and Hours</Text>
          <Text style={styles.reportPeriod}>Current Period</Text>
        </View>
        <ExportButton label="CSV" />
      </View>

      <View style={styles.reportRow}>
        <View style={styles.reportItem}>
          <Text style={styles.reportItemLabel}>Total Materials</Text>
          <CurrencyText amount={report.totalMaterials} style={styles.reportItemValue} />
        </View>
        <View style={styles.reportItem}>
          <Text style={styles.reportItemLabel}>Labor Cost</Text>
          <CurrencyText amount={report.totalLaborCost} style={styles.reportItemValue} />
        </View>
        <View style={styles.reportItem}>
          <Text style={styles.reportItemLabel}>Total Hours</Text>
          <Text style={[styles.reportItemValue, { fontFamily: 'Menlo' }]}>
            {report.totalHours}h
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.expandToggle}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.expandToggleText}>Detailed Breakdown</Text>
        <ChevronDown
          size={14}
          color={colors.textSecondary}
          strokeWidth={1.5}
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.breakdown}>
          <Text style={styles.breakdownSection}>Materials by Category</Text>
          {report.materials.map((item) => (
            <View key={item.category} style={styles.materialRow}>
              <View style={styles.materialInfo}>
                <Text style={styles.materialLabel}>{item.category}</Text>
                <View style={styles.materialBar}>
                  <View
                    style={[
                      styles.materialBarFill,
                      { width: `${item.percentage}%`, backgroundColor: colors.primary },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.materialNumbers}>
                <CurrencyText amount={item.amount} style={styles.materialValue} />
                <Text style={styles.materialPct}>{item.percentage}%</Text>
              </View>
            </View>
          ))}

          <Text style={[styles.breakdownSection, { marginTop: 12 }]}>Labor Hours by Role</Text>
          {report.hours.map((item) => (
            <View key={item.role} style={styles.breakdownRow}>
              <View style={styles.hoursInfo}>
                <Text style={styles.breakdownLabel}>{item.role}</Text>
                <View style={styles.hoursDetail}>
                  <Clock size={11} color={colors.textTertiary} strokeWidth={1.5} />
                  <Text style={styles.hoursText}>{item.hours}h</Text>
                </View>
              </View>
              <CurrencyText amount={item.cost} style={styles.breakdownValue} />
            </View>
          ))}
        </View>
      )}
    </GlassCard>
  );
}

export default function ReportsScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports</Text>
        <View style={styles.headerRight}>
          <DollarSign size={14} color={colors.textSecondary} strokeWidth={1.5} />
          <Text style={styles.headerPeriod}>Q1 2026</Text>
        </View>
      </View>

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
        <TaxReportCard />
        <JobProfitCard />
        <MaterialsHoursCard />
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerPeriod: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  reportCard: {
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  reportIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportTitleBlock: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  reportPeriod: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,122,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.30)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 32,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  reportMainStat: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reportMainValue: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'Menlo',
  },
  reportMainLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  reportRow: {
    flexDirection: 'row',
    gap: 0,
    marginBottom: 10,
  },
  reportItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  reportItemLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    marginBottom: 4,
    textAlign: 'center',
  },
  reportItemValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'Menlo',
  },
  avgMarginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: 4,
  },
  avgMarginLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  avgMarginValue: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Menlo',
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    minHeight: 40,
  },
  expandToggleText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  breakdown: {
    marginTop: 4,
    gap: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  breakdownLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'Menlo',
  },
  jobProfitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  jobProfitInfo: {
    flex: 1,
    marginRight: 10,
  },
  jobProfitName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  jobProfitCustomer: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  jobProfitNumbers: {
    alignItems: 'flex-end',
  },
  jobProfitValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'Menlo',
  },
  jobProfitMargin: {
    fontSize: 12,
    fontWeight: '500',
  },
  breakdownSection: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    gap: 10,
  },
  materialInfo: {
    flex: 1,
  },
  materialLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  materialBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  materialBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  materialNumbers: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  materialValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'Menlo',
  },
  materialPct: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  hoursInfo: {
    flex: 1,
    marginRight: 10,
  },
  hoursDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  hoursText: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  bottomSpacer: {
    height: 100,
  },
});
