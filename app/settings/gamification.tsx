import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Award, Crown, Flame, ShieldCheck, Sparkles, Star, Trophy } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/constants/colors';

const ACHIEVEMENTS = [
  { id: 'streak', title: '7-Day Streak', subtitle: 'Saved parking 7 days in a row', icon: Flame, unlocked: true },
  { id: 'navigator', title: 'Precision Navigator', subtitle: 'Reached your car under 3 min, 10 times', icon: ShieldCheck, unlocked: true },
  { id: 'collector', title: 'Spot Collector', subtitle: 'Save 50 named parking spots', icon: Trophy, unlocked: false },
  { id: 'elite', title: 'Elite Commuter', subtitle: 'Maintain 90% weekly consistency', icon: Crown, unlocked: false },
] as const;

export default function GamificationScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const router = useRouter();

  const level = 7;
  const xp = 1420;
  const nextLevelXp = 1600;
  const progress = useMemo(() => Math.min(1, Math.max(0, xp / nextLevelXp)), [xp, nextLevelXp]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight ?? colors.border }]} onPress={() => router.back()}>
            <ArrowLeft size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Driver Prestige</Text>
          <View style={styles.placeholder} />
        </View>

        <LinearGradient colors={colors.accentGradient} style={styles.hero}>
          <Sparkles size={18} color="#FFFFFF" />
          <Text style={styles.heroLabel}>Premium progression</Text>
          <Text style={styles.heroLevel}>Level {level}</Text>
          <Text style={styles.heroXp}>{xp} XP • {nextLevelXp - xp} XP to next level</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.borderLight ?? colors.border }]}>
            <Award size={16} color={colors.accent} />
            <Text style={[styles.statValue, { color: colors.text }]}>12</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Badges</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.borderLight ?? colors.border }]}>
            <Flame size={16} color={colors.warning} />
            <Text style={[styles.statValue, { color: colors.text }]}>5 days</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Current streak</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.borderLight ?? colors.border }]}>
            <Star size={16} color={colors.success} />
            <Text style={[styles.statValue, { color: colors.text }]}>87%</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Consistency</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ACHIEVEMENTS</Text>
        {ACHIEVEMENTS.map((item) => {
          const Icon = item.icon;
          return (
            <View key={item.id} style={[styles.achievementCard, { backgroundColor: colors.card, borderColor: colors.borderLight ?? colors.border }]}>
              <View style={[styles.achievementIcon, { backgroundColor: item.unlocked ? colors.accent + '18' : colors.surfaceSecondary }]}>
                <Icon size={18} color={item.unlocked ? colors.accent : colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.achievementTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.achievementSubtitle, { color: colors.textMuted }]}>{item.subtitle}</Text>
              </View>
              <Text style={[styles.pill, { color: item.unlocked ? colors.success : colors.textMuted, backgroundColor: item.unlocked ? colors.success + '20' : colors.surfaceSecondary }]}>
                {item.unlocked ? 'Unlocked' : 'In Progress'}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 0.8, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800' },
  placeholder: { width: 40 },
  hero: { borderRadius: 22, padding: 18, gap: 6 },
  heroLabel: { color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroLevel: { color: '#FFFFFF', fontSize: 34, fontWeight: '800' },
  heroXp: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' },
  track: { marginTop: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, overflow: 'hidden', height: 10 },
  fill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 999 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderWidth: 0.8, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 17, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '600' },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginTop: 2 },
  achievementCard: { borderWidth: 0.8, borderRadius: 16, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' },
  achievementIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  achievementTitle: { fontSize: 14, fontWeight: '700' },
  achievementSubtitle: { fontSize: 12, marginTop: 2 },
  pill: { fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: 'hidden' },
});
