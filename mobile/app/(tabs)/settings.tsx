import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  FileText,
  ScrollText,
  Package,
  Receipt,
  Users,
  ChevronRight,
  Upload,
  Plus,
  Pencil,
  Shield,
} from 'lucide-react-native';
import { api } from '../../lib/api';
import { colors, glass, typography } from '../../constants/theme';
import GlassCard from '../../components/GlassCard';
import { useAuthStore } from '../../stores/auth';

interface CompanySettings {
  name: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  website?: string;
  phone: string;
  address: string;
}

interface DocumentDefaults {
  estimateValidDays: number;
  invoicePaymentTerms: string;
  defaultNotes: string;
  footerText: string;
  autoNumberPrefix: string;
}

interface TaxProfile {
  id: string;
  name: string;
  rate: number;
  isDefault: boolean;
  appliesTo: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'estimator' | 'crew';
  status: 'active' | 'invited' | 'inactive';
}

const FALLBACK_COMPANY: CompanySettings = {
  name: 'BrushPro Painting Co.',
  primaryColor: '#007AFF',
  accentColor: '#34C759',
  phone: '(555) 800-1234',
  address: '400 Commerce St, Suite 210, Springfield, IL 62701',
};

const FALLBACK_DOC_DEFAULTS: DocumentDefaults = {
  estimateValidDays: 30,
  invoicePaymentTerms: 'Net 15',
  defaultNotes: 'Thank you for your business.',
  footerText: 'Licensed, Bonded and Insured.',
  autoNumberPrefix: 'BP',
};

const FALLBACK_TAX_PROFILES: TaxProfile[] = [
  { id: '1', name: 'Standard', rate: 8.97, isDefault: true, appliesTo: 'Materials' },
  { id: '2', name: 'Labor (Exempt)', rate: 0, isDefault: false, appliesTo: 'Labor' },
  { id: '3', name: 'Commercial Rate', rate: 7.5, isDefault: false, appliesTo: 'Commercial Jobs' },
];

const FALLBACK_TEAM: TeamMember[] = [
  { id: '1', name: 'Alex Nakata', email: 'alex@brushpro.com', role: 'owner', status: 'active' },
  { id: '2', name: 'Marcus Webb', email: 'marcus@brushpro.com', role: 'manager', status: 'active' },
  { id: '3', name: 'Jake Torres', email: 'jake@brushpro.com', role: 'crew', status: 'active' },
  { id: '4', name: 'Pending Invite', email: 'newmember@example.com', role: 'estimator', status: 'invited' },
];

function useCompanySettings() {
  return useQuery<CompanySettings>({
    queryKey: ['settings', 'company'],
    queryFn: () => api.get('/settings/company').then((r) => r.data),
    placeholderData: FALLBACK_COMPANY,
  });
}

function useDocumentDefaults() {
  return useQuery<DocumentDefaults>({
    queryKey: ['settings', 'documents'],
    queryFn: () => api.get('/settings/documents').then((r) => r.data),
    placeholderData: FALLBACK_DOC_DEFAULTS,
  });
}

function useTaxProfiles() {
  return useQuery<TaxProfile[]>({
    queryKey: ['settings', 'tax-profiles'],
    queryFn: () => api.get('/settings/tax-profiles').then((r) => r.data),
    placeholderData: FALLBACK_TAX_PROFILES,
  });
}

function useTeamMembers() {
  return useQuery<TeamMember[]>({
    queryKey: ['settings', 'team'],
    queryFn: () => api.get('/settings/team').then((r) => r.data),
    placeholderData: FALLBACK_TEAM,
  });
}

function SectionHeader({
  icon: Icon,
  title,
  color,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  title: string;
  color: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
        <Icon size={16} color={color} strokeWidth={1.5} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.settingsRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={styles.settingsRowLabel}>{label}</Text>
      <View style={styles.settingsRowRight}>
        {value && <Text style={styles.settingsRowValue} numberOfLines={1}>{value}</Text>}
        {onPress && (
          <ChevronRight size={16} color={colors.textTertiary} strokeWidth={1.5} />
        )}
      </View>
    </TouchableOpacity>
  );
}

function BrandingSection() {
  const { data: company } = useCompanySettings();
  const [watermark, setWatermark] = useState(true);

  if (!company) return null;

  return (
    <View style={styles.section}>
      <SectionHeader icon={Building2} title="Company Branding" color={colors.primary} />
      <GlassCard>
        <View style={styles.logoRow}>
          <View style={styles.logoPlaceholder}>
            <Building2 size={24} color={colors.textTertiary} strokeWidth={1.5} />
          </View>
          <View style={styles.logoInfo}>
            <Text style={styles.logoLabel}>Company Logo</Text>
            <Text style={styles.logoSub}>PNG or SVG, min 300px</Text>
          </View>
          <TouchableOpacity style={styles.uploadBtn} activeOpacity={0.7}>
            <Upload size={14} color={colors.primary} strokeWidth={1.5} />
            <Text style={styles.uploadBtnText}>Upload</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />
        <SettingsRow label="Company Name" value={company.name} onPress={() => {}} />
        <View style={styles.divider} />
        <SettingsRow label="Phone" value={company.phone} onPress={() => {}} />
        <View style={styles.divider} />
        <SettingsRow label="Address" value={company.address} onPress={() => {}} />
        <View style={styles.divider} />

        <View style={styles.colorRow}>
          <Text style={styles.colorLabel}>Primary Color</Text>
          <View style={styles.colorPreview}>
            <View style={[styles.colorSwatch, { backgroundColor: company.primaryColor }]} />
            <Text style={styles.colorHex}>{company.primaryColor}</Text>
          </View>
        </View>

        <View style={styles.divider} />
        <View style={styles.toggleRow}>
          <Text style={styles.settingsRowLabel}>Brand Watermark on Documents</Text>
          <Switch
            value={watermark}
            onValueChange={setWatermark}
            trackColor={{ false: colors.surface, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </GlassCard>
    </View>
  );
}

function DocumentDefaultsSection() {
  const { data: defaults } = useDocumentDefaults();
  if (!defaults) return null;

  return (
    <View style={styles.section}>
      <SectionHeader icon={FileText} title="Document Defaults" color={colors.success} />
      <GlassCard>
        <SettingsRow label="Estimate Valid For" value={`${defaults.estimateValidDays} days`} onPress={() => {}} />
        <View style={styles.divider} />
        <SettingsRow label="Invoice Payment Terms" value={defaults.invoicePaymentTerms} onPress={() => {}} />
        <View style={styles.divider} />
        <SettingsRow label="Auto-Number Prefix" value={defaults.autoNumberPrefix} onPress={() => {}} />
        <View style={styles.divider} />
        <SettingsRow label="Default Footer" value={defaults.footerText} onPress={() => {}} />
        <View style={styles.divider} />
        <SettingsRow label="Default Notes" value={defaults.defaultNotes} onPress={() => {}} />
      </GlassCard>
    </View>
  );
}

function ContractTemplateSection() {
  return (
    <View style={styles.section}>
      <SectionHeader icon={ScrollText} title="Contract Template" color={colors.warning} />
      <GlassCard style={styles.contractCard}>
        <Text style={styles.contractDesc}>
          Customize your standard service agreement. Variables like client name, job address, and total are auto-filled when generating contracts.
        </Text>
        <View style={styles.contractActions}>
          <TouchableOpacity style={styles.contractBtn} activeOpacity={0.7}>
            <Pencil size={14} color={colors.textSecondary} strokeWidth={1.5} />
            <Text style={styles.contractBtnText}>Edit Template</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contractBtn} activeOpacity={0.7}>
            <FileText size={14} color={colors.textSecondary} strokeWidth={1.5} />
            <Text style={styles.contractBtnText}>Preview</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>
    </View>
  );
}

function MaterialPriceBookSection() {
  const materials = [
    { name: 'Sherwin-Williams Emerald', price: '$72.00 / gal' },
    { name: 'SW Duration Exterior', price: '$64.00 / gal' },
    { name: 'Primer — PVA', price: '$28.00 / gal' },
    { name: 'Caulk (11oz tube)', price: '$4.50 / ea' },
  ];

  return (
    <View style={styles.section}>
      <SectionHeader icon={Package} title="Material Price Book" color={colors.primary} />
      <GlassCard>
        {materials.map((m, index) => (
          <View key={m.name}>
            <SettingsRow label={m.name} value={m.price} onPress={() => {}} />
            {index < materials.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
        <View style={styles.divider} />
        <TouchableOpacity style={styles.addItemRow} activeOpacity={0.7}>
          <Plus size={14} color={colors.primary} strokeWidth={2} />
          <Text style={styles.addItemText}>Add Material</Text>
        </TouchableOpacity>
      </GlassCard>
    </View>
  );
}

function TaxProfilesSection() {
  const { data: profiles = [] } = useTaxProfiles();

  return (
    <View style={styles.section}>
      <SectionHeader icon={Receipt} title="Tax Profiles" color={colors.warning} />
      <GlassCard>
        {profiles.map((profile, index) => (
          <View key={profile.id}>
            <View style={styles.taxProfileRow}>
              <View style={styles.taxProfileInfo}>
                <View style={styles.taxProfileName}>
                  <Text style={styles.taxNameText}>{profile.name}</Text>
                  {profile.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.taxAppliesTo}>{profile.appliesTo}</Text>
              </View>
              <View style={styles.taxProfileRight}>
                <Text style={styles.taxRateText}>{profile.rate.toFixed(2)}%</Text>
                <TouchableOpacity hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pencil size={14} color={colors.textTertiary} strokeWidth={1.5} />
                </TouchableOpacity>
              </View>
            </View>
            {index < profiles.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
        <View style={styles.divider} />
        <TouchableOpacity style={styles.addItemRow} activeOpacity={0.7}>
          <Plus size={14} color={colors.primary} strokeWidth={2} />
          <Text style={styles.addItemText}>Add Tax Profile</Text>
        </TouchableOpacity>
      </GlassCard>
    </View>
  );
}

const ROLE_COLORS: Record<TeamMember['role'], string> = {
  owner: colors.yellow,
  manager: colors.primary,
  estimator: colors.success,
  crew: colors.textSecondary,
};

const STATUS_COLORS: Record<TeamMember['status'], string> = {
  active: colors.success,
  invited: colors.warning,
  inactive: colors.textTertiary,
};

function UserManagementSection() {
  const { data: team = [] } = useTeamMembers();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'owner' || !user;

  if (!isOwner) return null;

  return (
    <View style={styles.section}>
      <SectionHeader icon={Users} title="User Management" color={colors.success} />
      <GlassCard>
        {team.map((member, index) => (
          <View key={member.id}>
            <View style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {member.name
                    .split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberEmail}>{member.email}</Text>
              </View>
              <View style={styles.memberRight}>
                <View
                  style={[
                    styles.rolePill,
                    {
                      backgroundColor: `${ROLE_COLORS[member.role]}15`,
                      borderColor: `${ROLE_COLORS[member.role]}30`,
                    },
                  ]}
                >
                  <Text style={[styles.roleText, { color: ROLE_COLORS[member.role] }]}>
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </Text>
                </View>
                <View
                  style={[styles.statusDot, { backgroundColor: STATUS_COLORS[member.status] }]}
                />
              </View>
            </View>
            {index < team.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
        <View style={styles.divider} />
        <TouchableOpacity style={styles.addItemRow} activeOpacity={0.7}>
          <Plus size={14} color={colors.primary} strokeWidth={2} />
          <Text style={styles.addItemText}>Invite Team Member</Text>
        </TouchableOpacity>
      </GlassCard>

      <GlassCard
        style={[
          styles.ownerNote,
          { borderColor: 'rgba(255,215,10,0.25)', backgroundColor: 'rgba(255,215,10,0.06)' },
        ]}
      >
        <Shield size={14} color={colors.yellow} strokeWidth={1.5} />
        <Text style={styles.ownerNoteText}>
          User management is only visible to the account Owner.
        </Text>
      </GlassCard>
    </View>
  );
}

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <BrandingSection />
        <DocumentDefaultsSection />
        <ContractTemplateSection />
        <MaterialPriceBookSection />
        <TaxProfilesSection />
        <UserManagementSection />
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 44,
  },
  settingsRowLabel: {
    fontSize: 15,
    color: colors.textPrimary,
    flex: 1,
  },
  settingsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'flex-end',
  },
  settingsRowValue: {
    fontSize: 14,
    color: colors.textSecondary,
    maxWidth: 160,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 14,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInfo: {
    flex: 1,
  },
  logoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  logoSub: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,122,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.30)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minHeight: 34,
  },
  uploadBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  colorLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  colorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorSwatch: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  colorHex: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: 'Menlo',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  contractCard: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  contractDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 14,
  },
  contractActions: {
    flexDirection: 'row',
    gap: 10,
  },
  contractBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 38,
  },
  contractBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  addItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
  },
  addItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.primary,
  },
  taxProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 52,
  },
  taxProfileInfo: {
    flex: 1,
  },
  taxProfileName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  taxNameText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  defaultBadge: {
    backgroundColor: 'rgba(0,122,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.25)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  defaultBadgeText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '600',
  },
  taxAppliesTo: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  taxProfileRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taxRateText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'Menlo',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,122,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  memberRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rolePill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ownerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  ownerNoteText: {
    fontSize: 13,
    color: colors.yellow,
    flex: 1,
    lineHeight: 18,
  },
  bottomSpacer: {
    height: 100,
  },
});
