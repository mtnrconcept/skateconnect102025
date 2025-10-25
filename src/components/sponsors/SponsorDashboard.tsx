import { useMemo, useState } from 'react';
import {
  BarChart3,
  KeyRound,
  Mail,
  Megaphone,
  Phone,
  RefreshCw,
  Store,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { useSponsorContext } from '../../contexts/SponsorContext';
import SponsorAnalyticsSection from './analytics/SponsorAnalyticsSection';

const viewDefinitions = [
  { id: 'overview' as const, label: "Vue d'ensemble", icon: BarChart3 },
  { id: 'spotlights' as const, label: 'Spotlight', icon: Megaphone },
  { id: 'shop' as const, label: 'Boutique', icon: Store },
  { id: 'api-keys' as const, label: 'Clés API', icon: KeyRound },
];

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  scheduled: 'Programmé',
  active: 'Actif',
  completed: 'Terminé',
};

const availableScopes = [
  { id: 'analytics:read', label: 'Lecture analytics' },
  { id: 'spotlights:write', label: 'Gestion Spotlight' },
  { id: 'shop:write', label: 'Gestion boutique' },
];

function renderStatusBadge(status: string) {
  const colorMap: Record<string, string> = {
    draft: 'bg-slate-800 text-slate-200 border border-slate-600',
    scheduled: 'bg-blue-900/60 text-blue-100 border border-blue-500/50',
    active: 'bg-emerald-900/60 text-emerald-100 border border-emerald-500/50',
    completed: 'bg-purple-900/60 text-purple-100 border border-purple-500/50',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${colorMap[status] ?? colorMap.draft}`}>
      {statusLabels[status] ?? status}
    </span>
  );
}

export default function SponsorDashboard() {
  const {
    isSponsor,
    branding,
    contactEmail,
    contactPhone,
    permissions,
    analytics,
    spotlights,
    shopItems,
    apiKeys,
    loading,
    error,
    activeView,
    setActiveView,
    refreshAll,
    updateSpotlightStatus,
    updateShopItemAvailability,
    revokeApiKey,
    createApiKey,
  } = useSponsorContext();
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeyScopes, setApiKeyScopes] = useState<string[]>(['analytics:read']);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);

  const primaryColor = branding?.primary_color ?? '#0ea5e9';
  const secondaryColor = branding?.secondary_color ?? '#1e293b';

  const overviewCards = useMemo(
    () => [
      {
        icon: Users,
        title: 'Portée communautaire',
        value: analytics?.reach ? analytics.reach.toLocaleString('fr-FR') : '—',
        description: "Nombre total de riders touchés sur la période.",
      },
      {
        icon: Tag,
        title: 'Taux engagement',
        value: analytics?.engagement_rate ? `${analytics.engagement_rate.toFixed(2)} %` : '—',
        description: "Interactions moyennes par activation.",
      },
      {
        icon: Megaphone,
        title: 'Activations',
        value: analytics?.activation_count ? analytics.activation_count.toString() : '—',
        description: 'Spotlight et campagnes actives.',
      },
    ],
    [analytics],
  );

  if (!isSponsor) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-slate-200">
        <h2 className="text-3xl font-semibold mb-4">Accès sponsor requis</h2>
        <p className="text-slate-400">
          Connecte-toi avec un compte sponsor pour accéder au cockpit de pilotage des campagnes.
        </p>
      </div>
    );
  }

  const handleCreateApiKey = async () => {
    if (!apiKeyName.trim()) {
      return;
    }
    setIsCreatingKey(true);
    setCreatedKey(null);
    try {
      const result = await createApiKey({ name: apiKeyName.trim(), scopes: apiKeyScopes });
      if (result) {
        setCreatedKey(result.key);
        setApiKeyName('');
      }
    } finally {
      setIsCreatingKey(false);
    }
  };

  const renderOverview = () => (
    <div className="space-y-8">
      <div
        className="rounded-3xl border border-slate-700/60 overflow-hidden"
        style={{ boxShadow: `0 25px 45px -20px ${primaryColor}40` }}
      >
        <div
          className="p-8 text-white"
          style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="uppercase tracking-widest text-sm text-white/70">Profil sponsor</p>
              <h1 className="text-3xl font-bold mt-2">{branding?.brand_name ?? 'Marque partenaire'}</h1>
              {branding?.tagline && <p className="mt-2 text-white/80">{branding.tagline}</p>}
            </div>
            <div className="flex flex-col gap-2 text-sm text-white/80">
              {contactEmail && (
                <span className="inline-flex items-center gap-2"><Mail size={16} /> {contactEmail}</span>
              )}
              {contactPhone && (
                <span className="inline-flex items-center gap-2"><Phone size={16} /> {contactPhone}</span>
              )}
            </div>
          </div>
        </div>
        <div className="grid gap-6 grid-cols-1 md:grid-cols-3 p-6 bg-slate-900/80">
          {overviewCards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-slate-700/70 bg-slate-900/60 px-6 py-5"
            >
              <div className="flex items-center justify-between mb-4">
                <card.icon className="text-slate-300" size={20} />
                <span className="text-xs uppercase tracking-widest text-slate-500">{card.title}</span>
              </div>
              <p className="text-3xl font-semibold text-white">{card.value}</p>
              <p className="text-sm text-slate-400 mt-2">{card.description}</p>
            </div>
          ))}
        </div>
      </div>

      <SponsorAnalyticsSection />
    </div>
  );

  const renderSpotlights = () => (
    <div className="space-y-6">
      {!permissions.canManageSpotlights ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-6 text-rose-200">
          Ta marque n'a pas encore accès à la gestion des Spotlight. Contacte ton chargé de compte pour activer l'option.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">Spotlight actifs</h2>
            <button
              type="button"
              onClick={refreshAll}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white"
            >
              <RefreshCw size={16} /> Rafraîchir
            </button>
          </div>
          <div className="grid gap-4">
            {spotlights.length === 0 ? (
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-6 text-slate-300">
                Aucun Spotlight pour le moment. Publie ton premier projet sponsorisé pour apparaître ici.
              </div>
            ) : (
              spotlights.map((spotlight) => (
                <div
                  key={spotlight.id}
                  className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      {renderStatusBadge(spotlight.status)}
                      {spotlight.start_date && (
                        <span className="text-xs text-slate-400">
                          {new Date(spotlight.start_date).toLocaleDateString('fr-FR')}
                          {spotlight.end_date ? ` → ${new Date(spotlight.end_date).toLocaleDateString('fr-FR')}` : ''}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-semibold text-white">{spotlight.title}</h3>
                    {spotlight.description && (
                      <p className="text-sm text-slate-300 max-w-3xl">{spotlight.description}</p>
                    )}
                    {spotlight.call_to_action && (
                      <p className="text-sm text-slate-400">
                        CTA : <span className="text-slate-200">{spotlight.call_to_action}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {spotlight.status !== 'active' && (
                      <button
                        type="button"
                        onClick={() => updateSpotlightStatus(spotlight.id, 'active')}
                        className="rounded-full border border-emerald-500/60 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/10"
                      >
                        Activer
                      </button>
                    )}
                    {spotlight.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => updateSpotlightStatus(spotlight.id, 'completed')}
                        className="rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
                      >
                        Terminer
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );

  const renderShop = () => (
    <div className="space-y-6">
      {!permissions.canManageShop ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/40 p-6 text-amber-100">
          La gestion de la boutique n'est pas incluse dans ton pack actuel.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shopItems.length === 0 ? (
            <div className="md:col-span-2 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-6 text-slate-300 text-center">
              Aucun produit listé pour l'instant.
            </div>
          ) : (
            shopItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                  <span className="text-sm text-slate-400">
                    {(item.price_cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: item.currency })}
                  </span>
                </div>
                {item.description && <p className="text-sm text-slate-300">{item.description}</p>}
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>Stock : {item.stock}</span>
                  <button
                    type="button"
                    onClick={() => updateShopItemAvailability(item.id, !item.is_active)}
                    className={`rounded-full border px-3 py-1 ${
                      item.is_active
                        ? 'border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10'
                        : 'border-slate-600 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {item.is_active ? 'Mettre en pause' : 'Réactiver'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  const renderApiKeys = () => (
    <div className="space-y-8">
      {!permissions.canManageApiKeys ? (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-6 text-slate-300">
          Les clés API sont réservées aux partenaires Enterprise.
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Générer une nouvelle clé</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col text-sm text-slate-300">
                Nom interne
                <input
                  className="mt-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-slate-500"
                  value={apiKeyName}
                  onChange={(event) => setApiKeyName(event.target.value)}
                  placeholder="Activation Q4 retail"
                />
              </label>
              <fieldset className="flex flex-col gap-2 text-sm text-slate-300">
                <legend className="font-medium text-slate-200">Scopes autorisés</legend>
                {availableScopes.map((scope) => {
                  const checked = apiKeyScopes.includes(scope.id);
                  return (
                    <label key={scope.id} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setApiKeyScopes((current) =>
                            checked ? current.filter((value) => value !== scope.id) : [...current, scope.id],
                          );
                        }}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-400 focus:ring-sky-500"
                      />
                      {scope.label}
                    </label>
                  );
                })}
              </fieldset>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCreateApiKey}
                disabled={isCreatingKey || apiKeyName.trim().length === 0 || apiKeyScopes.length === 0}
                className="inline-flex items-center gap-2 rounded-full border border-sky-500/70 px-4 py-2 text-sm text-sky-200 hover:bg-sky-500/10 disabled:opacity-50"
              >
                {isCreatingKey ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Création...
                  </>
                ) : (
                  'Créer une clé'
                )}
              </button>
              {createdKey && (
                <span className="text-xs text-emerald-300">
                  Copie la clé en lieu sûr : <code className="font-mono text-emerald-200">{createdKey}</code>
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70">
            <div className="border-b border-slate-700/60 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Clés existantes</h3>
              <span className="text-xs uppercase tracking-widest text-slate-500">{apiKeys.length} clé(s)</span>
            </div>
            <ul className="divide-y divide-slate-800/80">
              {apiKeys.length === 0 ? (
                <li className="px-6 py-6 text-sm text-slate-300">Aucune clé active.</li>
              ) : (
                apiKeys.map((apiKey) => (
                  <li key={apiKey.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-200 font-medium">{apiKey.name}</p>
                      <p className="text-xs text-slate-500">
                        Préfixe : {apiKey.key_prefix}•••• · Scopes : {apiKey.scopes.join(', ') || 'aucun'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs uppercase tracking-widest ${
                        apiKey.status === 'active' ? 'text-emerald-300' : 'text-slate-500'
                      }`}
                      >
                        {apiKey.status === 'active' ? 'active' : 'révoquée'}
                      </span>
                      {apiKey.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => revokeApiKey(apiKey.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/10"
                        >
                          <X size={14} /> Révoquer
                        </button>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Sponsor cockpit</p>
            <h1 className="text-3xl font-semibold text-white mt-2">Pilotage des activations</h1>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 hover:text-white"
          >
            <RefreshCw size={16} />
            Synchroniser
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 px-6 py-4 text-rose-200 text-sm">
            {error}
          </div>
        )}

        <nav className="flex flex-wrap gap-3">
          {viewDefinitions.map((view) => {
            const Icon = view.icon;
            const isActive = activeView === view.id;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                  isActive
                    ? 'border-sky-500/80 bg-sky-500/10 text-sky-100 shadow-[0_0_20px_rgba(14,165,233,0.25)]'
                    : 'border-slate-700/60 text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {view.label}
              </button>
            );
          })}
        </nav>

        <div className={loading ? 'opacity-60 pointer-events-none' : ''}>
          {activeView === 'overview' && renderOverview()}
          {activeView === 'spotlights' && renderSpotlights()}
          {activeView === 'shop' && renderShop()}
          {activeView === 'api-keys' && renderApiKeys()}
        </div>
      </div>
    </div>
  );
}
