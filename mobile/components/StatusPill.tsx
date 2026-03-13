import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const STATUS_MAP: Record<string, { bg: string; text: string; label: string }> = {
  // Job statuses
  draft:       { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.60)', label: 'Draft' },
  scheduled:   { bg: 'rgba(0,122,255,0.15)',   text: '#007AFF',                label: 'Scheduled' },
  in_progress: { bg: 'rgba(255,149,0,0.15)',   text: '#FF9500',                label: 'In Progress' },
  completed:   { bg: 'rgba(52,199,89,0.15)',   text: '#34C759',                label: 'Completed' },
  invoiced:    { bg: 'rgba(0,122,255,0.12)',   text: '#007AFF',                label: 'Invoiced' },
  paid:        { bg: 'rgba(52,199,89,0.15)',   text: '#34C759',                label: 'Paid' },
  // Invoice / approval statuses
  overdue:     { bg: 'rgba(255,59,48,0.15)',   text: '#FF3B30',                label: 'Overdue' },
  pending:     { bg: 'rgba(255,149,0,0.15)',   text: '#FF9500',                label: 'Pending' },
  approved:    { bg: 'rgba(52,199,89,0.15)',   text: '#34C759',                label: 'Approved' },
  denied:      { bg: 'rgba(255,59,48,0.15)',   text: '#FF3B30',                label: 'Denied' },
  cancelled:   { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.35)', label: 'Cancelled' },
  void:        { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.35)', label: 'Void' },
  // Campaign statuses
  sent:        { bg: 'rgba(0,122,255,0.12)',   text: '#007AFF',                label: 'Sent' },
  active:      { bg: 'rgba(52,199,89,0.15)',   text: '#34C759',                label: 'Active' },
  // Contact types
  prospect:    { bg: 'rgba(255,214,10,0.15)',  text: '#FFD60A',                label: 'Prospect' },
  customer:    { bg: 'rgba(0,122,255,0.12)',   text: '#007AFF',                label: 'Customer' },
  vendor:      { bg: 'rgba(52,199,89,0.12)',   text: '#34C759',                label: 'Vendor' },
};

const FALLBACK = { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.60)', label: '' };

interface StatusPillProps {
  status: string;
  label?: string;
}

export default function StatusPill({ status, label }: StatusPillProps) {
  const key = status.toLowerCase().replace(/\s+/g, '_');
  const config = STATUS_MAP[key] ?? FALLBACK;
  const displayLabel = label ?? config.label || (status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '));

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: config.bg, borderColor: `${config.text}30` },
      ]}
    >
      <Text style={[styles.text, { color: config.text }]}>{displayLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
