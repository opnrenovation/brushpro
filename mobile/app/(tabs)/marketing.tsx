import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  Send,
  Eye,
  MousePointer,
  TrendingUp,
  Layout,
  FileText,
  Mail,
} from 'lucide-react-native';
import { api } from '../../lib/api';
import { colors, glass, typography } from '../../constants/theme';
import GlassCard from '../../components/GlassCard';

type MarketingTab = 'campaigns' | 'templates' | 'analytics';

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'sent' | 'active';
  type: 'email' | 'sms';
  sentDate?: string;
  recipientCount: number;
  openRate?: number;
  clickRate?: number;
}

interface Template {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'postcard';
  category: string;
  lastUsed?: string;
  useCount: number;
}

interface AnalyticsStats {
  totalSent: number;
  avgOpenRate: number;
  avgClickRate: number;
  leadsGenerated: number;
}

const FALLBACK_CAMPAIGNS: Campaign[] = [
  { id: '1', name: 'Spring Exterior Promo', status: 'sent', type: 'email', sentDate: '2026-03-01', recipientCount: 284, openRate: 38.2, clickRate: 12.4 },
  { id: '2', name: 'Referral Incentive — Q1', status: 'active', type: 'email', recipientCount: 112, openRate: 44.7, clickRate: 18.1 },
  { id: '3', name: 'New Service Announcement', status: 'scheduled', type: 'email', recipientCount: 500 },
  { id: '4', name: 'Follow-up: Henderson Neighbors', status: 'draft', type: 'sms', recipientCount: 22 },
];

const FALLBACK_TEMPLATES: Template[] = [
  { id: '1', name: 'Seasonal Promo', type: 'email', category: 'Promotion', lastUsed: '2026-03-01', useCount: 8 },
  { id: '2', name: 'Job Completion Thank You', type: 'email', category: 'Follow-up', lastUsed: '2026-02-28', useCount: 24 },
  { id: '3', name: 'Estimate Follow-up', type: 'email', category: 'Sales', lastUsed: '2026-02-20', useCount: 14 },
  { id: '4', name: 'Review Request', type: 'sms', category: 'Reviews', lastUsed: '2026-03-05', useCount: 31 },
  { id: '5', name: 'Referral Ask', type: 'email', category: 'Referrals', lastUsed: '2026-02-10', useCount: 6 },
  { id: '6', name: 'Neighborhood Postcard', type: 'postcard', category: 'Direct Mail', useCount: 2 },
];

const FALLBACK_ANALYTICS: AnalyticsStats = {
  totalSent: 1840,
  avgOpenRate: 36.5,
  avgClickRate: 11.2,
  leadsGenerated: 47,
};

function useCampaigns() {
  return useQuery<Campaign[]>({
    queryKey: ['marketing', 'campaigns'],
    queryFn: () => api.get('/marketing/campaigns').then((r) => r.data),
    placeholderData: FALLBACK_CAMPAIGNS,
  });
}

function useTemplates() {
  return useQuery<Template[]>({
    queryKey: ['marketing', 'templates'],
    queryFn: () => api.get('/marketing/templates').then((r) => r.data),
    placeholderData: FALLBACK_TEMPLATES,
  });
}

function useMarketingAnalytics() {
  return useQuery<AnalyticsStats>({
    queryKey: ['marketing', 'analytics'],
    queryFn: () => api.get('/marketing/analytics').then((r) => r.data),
    placeholderData: FALLBACK_ANALYTICS,
  });
}

const CAMPAIGN_STATUS_COLORS: Record<Campaign['status'], string> = {
  draft: colors.textTertiary,
  scheduled: colors.warning,
  sent: colors.primary,
  active: colors.success,
};

function CampaignStatusPill({ status }: { status: Campaign['status'] }) {
  const color = CAMPAIGN_STATUS_COLORS[status];
  return (
    <View style={[styles.statusPill, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
      <Text style={[styles.statusPillText, { color }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}

function CampaignsTab() {
  const { data: campaigns = [] } = useCampaigns();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.createCampaignBtn} activeOpacity={0.8}>
        <Send size={16} color="#FFFFFF" strokeWidth={1.5} />
        <Text style={styles.createCampaignText}>New Campaign</Text>
      </TouchableOpacity>

      {campaigns.map((campaign) => (
        <GlassCard key={campaign.id} style={styles.campaignCard}>
          <View style={styles.campaignHeader}>
            <View style={styles.campaignTypeIcon}>
              {campaign.type === 'email' ? (
                <Mail size={14} color={colors.primary} strokeWidth={1.5} />
              ) : (
                <FileText size={14} color={colors.warning} strokeWidth={1.5} />
              )}
            </View>
            <View style={styles.campaignTitleBlock}>
              <Text style={styles.campaignName} numberOfLines={1}>{campaign.name}</Text>
              <Text style={styles.campaignSub}>
                {campaign.type.toUpperCase()} — {campaign.recipientCount} recipients
                {campaign.sentDate
                  ? ` — Sent ${new Date(campaign.sentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  : ''}
              </Text>
            </View>
            <CampaignStatusPill status={campaign.status} />
          </View>

          {(campaign.openRate !== undefined || campaign.clickRate !== undefined) && (
            <View style={styles.campaignStats}>
              {campaign.openRate !== undefined && (
                <View style={styles.statItem}>
                  <Eye size={12} color={colors.textTertiary} strokeWidth={1.5} />
                  <Text style={styles.statValue}>{campaign.openRate.toFixed(1)}%</Text>
                  <Text style={styles.statLabel}>Open</Text>
                </View>
              )}
              {campaign.clickRate !== undefined && (
                <View style={styles.statItem}>
                  <MousePointer size={12} color={colors.textTertiary} strokeWidth={1.5} />
                  <Text style={styles.statValue}>{campaign.clickRate.toFixed(1)}%</Text>
                  <Text style={styles.statLabel}>Click</Text>
                </View>
              )}
              <View style={styles.statItem}>
                <Send size={12} color={colors.textTertiary} strokeWidth={1.5} />
                <Text style={styles.statValue}>{campaign.recipientCount}</Text>
                <Text style={styles.statLabel}>Sent</Text>
              </View>
            </View>
          )}
        </GlassCard>
      ))}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const TEMPLATE_TYPE_COLORS: Record<Template['type'], string> = {
  email: colors.primary,
  sms: colors.success,
  postcard: colors.warning,
};

const TEMPLATE_TYPE_ICONS: Record<Template['type'], React.ComponentType<{ size: number; color: string; strokeWidth: number }>> = {
  email: Mail,
  sms: FileText,
  postcard: Layout,
};

function TemplatesTab() {
  const { data: templates = [] } = useTemplates();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.templateGrid}>
        {templates.map((template) => {
          const color = TEMPLATE_TYPE_COLORS[template.type];
          const Icon = TEMPLATE_TYPE_ICONS[template.type];
          return (
            <GlassCard key={template.id} style={styles.templateCard}>
              <View style={[styles.templateThumb, { backgroundColor: `${color}12`, borderColor: `${color}25` }]}>
                <Icon size={24} color={color} strokeWidth={1.5} />
              </View>
              <Text style={styles.templateName} numberOfLines={2}>{template.name}</Text>
              <Text style={styles.templateCategory}>{template.category}</Text>
              <View style={styles.templateFooter}>
                <View style={[styles.templateTypeBadge, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
                  <Text style={[styles.templateTypeText, { color }]}>
                    {template.type.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.templateUseCount}>{template.useCount}x used</Text>
              </View>
            </GlassCard>
          );
        })}
      </View>
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

function AnalyticsTab() {
  const { data: stats } = useMarketingAnalytics();
  const { data: campaigns = [] } = useCampaigns();
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');

  const sentCampaigns = campaigns.filter((c) => c.status === 'sent' || c.status === 'active');

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.campaignSelector}
      >
        <TouchableOpacity
          style={[styles.selectorChip, selectedCampaign === 'all' && styles.selectorChipActive]}
          onPress={() => setSelectedCampaign('all')}
          activeOpacity={0.7}
        >
          <Text style={[styles.selectorText, selectedCampaign === 'all' && styles.selectorTextActive]}>
            All Campaigns
          </Text>
        </TouchableOpacity>
        {sentCampaigns.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.selectorChip, selectedCampaign === c.id && styles.selectorChipActive]}
            onPress={() => setSelectedCampaign(c.id)}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.selectorText, selectedCampaign === c.id && styles.selectorTextActive]}
              numberOfLines={1}
            >
              {c.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {stats && (
        <View style={styles.analyticsGrid}>
          <GlassCard style={styles.analyticsCard}>
            <Send size={18} color={colors.primary} strokeWidth={1.5} />
            <Text style={styles.analyticsValue}>{stats.totalSent.toLocaleString()}</Text>
            <Text style={styles.analyticsLabel}>Total Sent</Text>
          </GlassCard>
          <GlassCard style={styles.analyticsCard}>
            <Eye size={18} color={colors.success} strokeWidth={1.5} />
            <Text style={[styles.analyticsValue, { color: colors.success }]}>
              {stats.avgOpenRate.toFixed(1)}%
            </Text>
            <Text style={styles.analyticsLabel}>Avg Open Rate</Text>
          </GlassCard>
          <GlassCard style={styles.analyticsCard}>
            <MousePointer size={18} color={colors.warning} strokeWidth={1.5} />
            <Text style={[styles.analyticsValue, { color: colors.warning }]}>
              {stats.avgClickRate.toFixed(1)}%
            </Text>
            <Text style={styles.analyticsLabel}>Avg Click Rate</Text>
          </GlassCard>
          <GlassCard style={styles.analyticsCard}>
            <TrendingUp size={18} color={colors.yellow} strokeWidth={1.5} />
            <Text style={[styles.analyticsValue, { color: colors.yellow }]}>
              {stats.leadsGenerated}
            </Text>
            <Text style={styles.analyticsLabel}>Leads Generated</Text>
          </GlassCard>
        </View>
      )}

      <Text style={styles.sectionTitle}>Campaign Breakdown</Text>
      {sentCampaigns.map((c) => (
        <GlassCard key={c.id} style={styles.breakdownCard}>
          <Text style={styles.breakdownName}>{c.name}</Text>
          <View style={styles.breakdownStats}>
            <View style={styles.breakdownStat}>
              <Text style={styles.breakdownStatLabel}>Sent</Text>
              <Text style={styles.breakdownStatValue}>{c.recipientCount}</Text>
            </View>
            {c.openRate !== undefined && (
              <View style={styles.breakdownStat}>
                <Text style={styles.breakdownStatLabel}>Open Rate</Text>
                <Text style={[styles.breakdownStatValue, { color: colors.success }]}>
                  {c.openRate.toFixed(1)}%
                </Text>
              </View>
            )}
            {c.clickRate !== undefined && (
              <View style={styles.breakdownStat}>
                <Text style={styles.breakdownStatLabel}>Click Rate</Text>
                <Text style={[styles.breakdownStatValue, { color: colors.warning }]}>
                  {c.clickRate.toFixed(1)}%
                </Text>
              </View>
            )}
          </View>
          <View style={styles.rateBar}>
            <View
              style={[
                styles.rateBarFill,
                { width: `${c.openRate ?? 0}%`, backgroundColor: colors.success },
              ]}
            />
          </View>
        </GlassCard>
      ))}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

export default function MarketingScreen() {
  const [activeTab, setActiveTab] = useState<MarketingTab>('campaigns');

  const TOP_TABS: { key: MarketingTab; label: string }[] = [
    { key: 'campaigns', label: 'Campaigns' },
    { key: 'templates', label: 'Templates' },
    { key: 'analytics', label: 'Analytics' },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Marketing</Text>
      </View>

      <View style={styles.topTabBar}>
        {TOP_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.topTab, activeTab === tab.key && styles.topTabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.topTabLabel,
                activeTab === tab.key && styles.topTabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'campaigns' && <CampaignsTab />}
      {activeTab === 'templates' && <TemplatesTab />}
      {activeTab === 'analytics' && <AnalyticsTab />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  topTabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 0,
    gap: 4,
  },
  topTab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  topTabActive: {
    borderBottomColor: colors.primary,
  },
  topTabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  topTabLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  createCampaignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 16,
    minHeight: 44,
  },
  createCampaignText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  campaignCard: {
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  campaignHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  campaignTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  campaignTitleBlock: {
    flex: 1,
  },
  campaignName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  campaignSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  campaignStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  templateCard: {
    width: '47%',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  templateThumb: {
    width: '100%',
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  templateName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  templateCategory: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  templateFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  templateTypeBadge: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  templateTypeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  templateUseCount: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  campaignSelector: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
    paddingRight: 16,
  },
  selectorChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 34,
    justifyContent: 'center',
    maxWidth: 160,
  },
  selectorChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0,122,255,0.12)',
  },
  selectorText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  selectorTextActive: {
    color: colors.primary,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  analyticsCard: {
    width: '47%',
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  analyticsValue: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'Menlo',
  },
  analyticsLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  breakdownCard: {
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  breakdownName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  breakdownStats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 10,
  },
  breakdownStat: {
    gap: 2,
  },
  breakdownStatLabel: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  breakdownStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'Menlo',
  },
  rateBar: {
    height: 4,
    backgroundColor: colors.surface,
    borderRadius: 2,
    overflow: 'hidden',
  },
  rateBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  bottomSpacer: {
    height: 100,
  },
});
