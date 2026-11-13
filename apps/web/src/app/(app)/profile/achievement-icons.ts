import type { AchievementIcon } from '@belmaster/shared';
import { Award, BookOpen, Brain, Castle, CheckCircle2, Crown, Flame, Gem, GraduationCap, Medal, Mountain, Rocket, ScrollText, Shield, Star, Swords, Target, Trophy, Users, Zap } from 'lucide-react';

export const ACHIEVEMENT_ICONS: Record<AchievementIcon, typeof Star> = { star: Star, flame: Flame, award: Award, swords: Swords, crown: Crown, castle: Castle, book: BookOpen, users: Users, target: Target, shield: Shield, mountain: Mountain, trophy: Trophy, brain: Brain, graduation: GraduationCap, zap: Zap, medal: Medal, scroll: ScrollText, check: CheckCircle2, gem: Gem, rocket: Rocket };
