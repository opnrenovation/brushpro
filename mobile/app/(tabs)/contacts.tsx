import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Search, Upload, Phone, Mail, Building2 } from 'lucide-react-native';
import { api } from '../../lib/api';
import { colors, glass, typography } from '../../constants/theme';
import GlassCard from '../../components/GlassCard';

type ContactType = 'prospect' | 'customer' | 'vendor';
type FilterType = 'all' | 'prospect' | 'customer';
type TopTab = 'contacts' | 'lists' | 'import';

interface Contact {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone: string;
  type: ContactType;
  jobsCount?: number;
  totalRevenue?: number;
}

interface ContactList {
  id: string;
  name: string;
  count: number;
  lastUpdated: string;
  tags: string[];
}

const FALLBACK_CONTACTS: Contact[] = [
  { id: '1', name: 'Mark Henderson', company: undefined, email: 'mark@hendersonfamily.com', phone: '(555) 201-4892', type: 'customer', jobsCount: 3, totalRevenue: 18200 },
  { id: '2', name: 'Apex Realty', company: 'Apex Realty Group', email: 'contracts@apexrealty.com', phone: '(555) 340-0012', type: 'customer', jobsCount: 7, totalRevenue: 84500 },
  { id: '3', name: 'Elena Garcia', company: undefined, email: 'elena.garcia@email.com', phone: '(555) 778-3341', type: 'customer', jobsCount: 1, totalRevenue: 5600 },
  { id: '4', name: 'Sunrise Properties', company: 'Sunrise Properties LLC', email: 'ops@sunriseproperties.com', phone: '(555) 122-9944', type: 'customer', jobsCount: 4, totalRevenue: 62000 },
  { id: '5', name: 'David Kowalski', company: undefined, email: 'dkowalski@gmail.com', phone: '(555) 889-0021', type: 'prospect', jobsCount: 0, totalRevenue: 0 },
  { id: '6', name: 'Pacific Paint Supply', company: 'Pacific Paint Supply Co.', email: 'orders@pacificpaint.com', phone: '(555) 500-1188', type: 'vendor' },
];

const FALLBACK_LISTS: ContactList[] = [
  { id: '1', name: 'Spring 2026 Prospects', count: 48, lastUpdated: '2026-03-10', tags: ['prospect', 'residential'] },
  { id: '2', name: 'Commercial Clients', count: 23, lastUpdated: '2026-03-08', tags: ['customer', 'commercial'] },
  { id: '3', name: 'Referral Program', count: 15, lastUpdated: '2026-03-01', tags: ['customer', 'referral'] },
  { id: '4', name: 'Inactive Leads', count: 112, lastUpdated: '2026-02-20', tags: ['prospect'] },
];

function useContacts() {
  return useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: () => api.get('/contacts').then((r) => r.data),
    placeholderData: FALLBACK_CONTACTS,
  });
}

function useContactLists() {
  return useQuery<ContactList[]>({
    queryKey: ['contacts', 'lists'],
    queryFn: () => api.get('/contacts/lists').then((r) => r.data),
    placeholderData: FALLBACK_LISTS,
  });
}

const TYPE_COLORS: Record<ContactType, string> = {
  prospect: colors.warning,
  customer: colors.success,
  vendor: colors.primary,
};

function ContactTypePill({ type }: { type: ContactType }) {
  const color = TYPE_COLORS[type];
  return (
    <View
      style={[
        styles.typePill,
        { backgroundColor: `${color}18`, borderColor: `${color}40` },
      ]}
    >
      <Text style={[styles.typePillText, { color }]}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Text>
    </View>
  );
}

function ContactItem({ contact }: { contact: Contact }) {
  return (
    <GlassCard style={styles.contactCard}>
      <View style={styles.contactRow}>
        <View style={styles.contactAvatar}>
          <Text style={styles.contactAvatarText}>
            {contact.name
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </Text>
        </View>
        <View style={styles.contactInfo}>
          <View style={styles.contactNameRow}>
            <Text style={styles.contactName}>{contact.name}</Text>
            <ContactTypePill type={contact.type} />
          </View>
          {contact.company && (
            <View style={styles.contactMeta}>
              <Building2 size={11} color={colors.textTertiary} strokeWidth={1.5} />
              <Text style={styles.contactMetaText}>{contact.company}</Text>
            </View>
          )}
          <View style={styles.contactDetails}>
            <View style={styles.contactMeta}>
              <Mail size={11} color={colors.textTertiary} strokeWidth={1.5} />
              <Text style={styles.contactMetaText} numberOfLines={1}>{contact.email}</Text>
            </View>
            <View style={styles.contactMeta}>
              <Phone size={11} color={colors.textTertiary} strokeWidth={1.5} />
              <Text style={styles.contactMetaText}>{contact.phone}</Text>
            </View>
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

function AllContactsTab() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const { data: contacts = [], refetch } = useContacts();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const filtered = contacts.filter((c) => {
    const matchSearch =
      search.length === 0 ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.company?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchFilter =
      filter === 'all' || c.type === filter;
    return matchSearch && matchFilter;
  });

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'prospect', label: 'Prospect' },
    { key: 'customer', label: 'Customer' },
  ];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={styles.searchBar}>
        <Search size={16} color={colors.textTertiary} strokeWidth={1.5} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.resultCount}>
        {filtered.length} contact{filtered.length !== 1 ? 's' : ''}
      </Text>

      {filtered.map((contact) => (
        <ContactItem key={contact.id} contact={contact} />
      ))}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

function ListsTab() {
  const { data: lists = [] } = useContactLists();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
    >
      {lists.map((list) => (
        <GlassCard key={list.id} style={styles.listCard}>
          <View style={styles.listRow}>
            <View style={styles.listInfo}>
              <Text style={styles.listName}>{list.name}</Text>
              <Text style={styles.listMeta}>
                {list.count} contacts — Updated {new Date(list.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
              <View style={styles.tagRow}>
                {list.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.listCount}>
              <Text style={styles.listCountText}>{list.count}</Text>
            </View>
          </View>
        </GlassCard>
      ))}
      <TouchableOpacity style={styles.newListBtn} activeOpacity={0.7}>
        <Text style={styles.newListText}>+ Create New List</Text>
      </TouchableOpacity>
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

function ImportTab() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
    >
      <GlassCard style={styles.importCard}>
        <View style={styles.importIcon}>
          <Upload size={32} color={colors.primary} strokeWidth={1.5} />
        </View>
        <Text style={styles.importTitle}>Import Contacts</Text>
        <Text style={styles.importDesc}>
          Upload a CSV file with your contacts. Supported fields: name, email, phone, company, type.
        </Text>
        <TouchableOpacity style={styles.importBtn} activeOpacity={0.8}>
          <Upload size={16} color="#FFFFFF" strokeWidth={1.5} />
          <Text style={styles.importBtnText}>Choose CSV File</Text>
        </TouchableOpacity>
      </GlassCard>

      <GlassCard style={styles.templateCard}>
        <Text style={styles.templateTitle}>CSV Template</Text>
        <Text style={styles.templateDesc}>Download a template to see the correct column format.</Text>
        <TouchableOpacity style={styles.templateBtn} activeOpacity={0.8}>
          <Text style={styles.templateBtnText}>Download Template</Text>
        </TouchableOpacity>
      </GlassCard>
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

export default function ContactsScreen() {
  const [activeTab, setActiveTab] = useState<TopTab>('contacts');

  const TOP_TABS: { key: TopTab; label: string }[] = [
    { key: 'contacts', label: 'All Contacts' },
    { key: 'lists', label: 'Lists' },
    { key: 'import', label: 'Import' },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Contacts</Text>
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

      {activeTab === 'contacts' && <AllContactsTab />}
      {activeTab === 'lists' && <ListsTab />}
      {activeTab === 'import' && <ImportTab />}
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
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 0,
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    padding: 0,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 32,
    justifyContent: 'center',
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0,122,255,0.12)',
  },
  filterChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  resultCount: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 10,
  },
  contactCard: {
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  contactAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,122,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  contactInfo: {
    flex: 1,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  typePill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  contactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  contactMetaText: {
    fontSize: 12,
    color: colors.textTertiary,
    flex: 1,
  },
  contactDetails: {
    marginTop: 4,
    gap: 2,
  },
  listCard: {
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listInfo: {
    flex: 1,
    marginRight: 12,
  },
  listName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  listMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  listCount: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,122,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCountText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  newListBtn: {
    ...glass,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  newListText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.primary,
  },
  importCard: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    alignItems: 'center',
    marginBottom: 12,
  },
  importIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(0,122,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  importTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  importDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 44,
  },
  importBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  templateCard: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  templateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  templateDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  templateBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: 'flex-start',
    minHeight: 38,
    justifyContent: 'center',
  },
  templateBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  bottomSpacer: {
    height: 100,
  },
});
