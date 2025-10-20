import { useState, useEffect } from 'react';
import { TrendingUp, Plus, MessageCircle, Heart, MapPin, Video, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { XPTransaction, Profile } from '../types';

interface XPHistoryProps {
  profile: Profile;
}

export default function XPHistory({ profile }: XPHistoryProps) {
  const [transactions, setTransactions] = useState<XPTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'day' | 'week' | 'month'>('week');

  useEffect(() => {
    loadTransactions();
  }, [profile, filter]);

  const loadTransactions = async () => {
    try {
      let query = supabase
        .from('xp_transactions')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      const now = new Date();
      if (filter === 'day') {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        query = query.gte('created_at', yesterday.toISOString());
      } else if (filter === 'week') {
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        query = query.gte('created_at', lastWeek.toISOString());
      } else if (filter === 'month') {
        const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        query = query.gte('created_at', lastMonth.toISOString());
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading XP history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'add_spot':
        return <MapPin className="text-blue-500" size={20} />;
      case 'post_media':
        return <Video className="text-purple-500" size={20} />;
      case 'create_post':
        return <Plus className="text-green-500" size={20} />;
      case 'add_comment':
        return <MessageCircle className="text-cyan-500" size={20} />;
      case 'give_like':
        return <Heart className="text-red-500" size={20} />;
      default:
        return <TrendingUp className="text-orange-500" size={20} />;
    }
  };

  const getActionLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      add_spot: 'Spot ajouté',
      post_media: 'Média publié',
      create_post: 'Post créé',
      add_comment: 'Commentaire ajouté',
      give_like: 'Like donné',
    };
    return labels[actionType] || actionType;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return date.toLocaleDateString('fr-FR');
  };

  const totalXP = transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
      <div className="p-6 border-b border-dark-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Historique XP</h2>
          <div className="flex items-center gap-2 text-orange-500">
            <TrendingUp size={20} />
            <span className="text-2xl font-bold">+{totalXP}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {[
            { id: 'all' as const, label: 'Tout' },
            { id: 'day' as const, label: '24h' },
            { id: 'week' as const, label: '7j' },
            { id: 'month' as const, label: '30j' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setFilter(btn.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === btn.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Chargement...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <TrendingUp size={48} className="mx-auto mb-4 opacity-50" />
            <p>Aucune transaction XP pour cette période</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="bg-dark-900 rounded-lg p-4 border border-dark-700 flex items-center justify-between hover:border-dark-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-dark-800 rounded-full flex items-center justify-center">
                    {getActionIcon(transaction.action_type)}
                  </div>
                  <div>
                    <div className="font-semibold text-white">
                      {getActionLabel(transaction.action_type)}
                    </div>
                    <div className="text-sm text-gray-400 flex items-center gap-2">
                      <Calendar size={14} />
                      {formatDate(transaction.created_at)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-orange-500">
                    +{transaction.amount}
                  </div>
                  <div className="text-xs text-gray-400">XP</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
