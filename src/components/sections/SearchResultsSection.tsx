import { useMemo } from 'react';
import { Search, ArrowUpRight } from 'lucide-react';
import type { GlobalSearchResult } from '../../types/search';
import type { ContentNavigationOptions, Section } from '../../types';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface SearchResultsSectionProps {
  query: string;
  results: GlobalSearchResult[];
  onNavigate: (section: Section, options?: ContentNavigationOptions) => void;
}

export default function SearchResultsSection({ query, results, onNavigate }: SearchResultsSectionProps) {
  const highlightTokens = useMemo(
    () =>
      query
        .trim()
        .split(/\s+/)
        .filter(Boolean),
    [query],
  );

  const highlightRegex = useMemo(() => {
    if (highlightTokens.length === 0) {
      return null;
    }
    const escapedTokens = highlightTokens.map((token) => escapeRegExp(token));
    return new RegExp(`(${escapedTokens.join('|')})`, 'gi');
  }, [highlightTokens]);

  const highlightLower = useMemo(() => highlightTokens.map((token) => token.toLowerCase()), [highlightTokens]);

  const renderHighlightedText = (text: string) => {
    if (!highlightRegex || highlightLower.length === 0) {
      return text;
    }

    return text.split(highlightRegex).map((part, index) => {
      const isMatch = highlightLower.includes(part.toLowerCase());
      return isMatch ? (
        <span key={`${part}-${index}`} className="text-orange-400">
          {part}
        </span>
      ) : (
        <span key={`${part}-${index}`}>{part}</span>
      );
    });
  };

  const groupedResults = useMemo(() => {
    const groups = new Map<string, GlobalSearchResult[]>();
    results.forEach((result) => {
      const category = result.category || 'Autres';
      const current = groups.get(category) ?? [];
      current.push(result);
      groups.set(category, current);
    });
    return Array.from(groups.entries());
  }, [results]);

  const totalResults = results.length;
  const hasQuery = query.trim().length > 0;

  return (
    <section className="relative flex flex-col overflow-hidden rounded-3xl border border-dark-700 bg-dark-900/70 shadow-2xl shadow-orange-900/10 min-h-[520px]">
      <div className="border-b border-dark-700 bg-dark-900/80 px-6 py-6 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.35em] text-orange-400/80 mb-2">Recherche globale</p>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-bold text-white">Résultats de recherche</h2>
          <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase text-orange-200">
            {totalResults} résultat{totalResults > 1 ? 's' : ''}
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-gray-400">
          {hasQuery
            ? `Termes recherchés : « ${query} »`
            : 'Utilise le champ de recherche dans l’en-tête pour trouver des spots, des riders ou des contenus.'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {totalResults === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-dark-600 bg-dark-900/60 px-6 py-16 text-center text-gray-400">
            <Search size={42} className="text-orange-400/80" />
            <div>
              <p className="text-lg font-semibold text-white">Aucun résultat</p>
              <p className="mt-2 text-sm text-gray-500">
                {hasQuery
                  ? 'Ajuste ta recherche avec d’autres mots-clés ou vérifie l’orthographe de ce que tu as saisi.'
                  : 'Commence à taper dans la barre de recherche pour afficher des propositions instantanées.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {groupedResults.map(([category, categoryResults]) => (
              <div key={category} className="flex flex-col overflow-hidden rounded-2xl border border-dark-700/70 bg-dark-900/80">
                <div className="border-b border-dark-700/70 px-5 py-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-300/80">{category}</h3>
                    <span className="text-xs text-gray-500">
                      {categoryResults.length} résultat{categoryResults.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-dark-800/80">
                  {categoryResults.map((result) => {
                    const IconComponent = result.icon ?? Search;
                    const isClickable = Boolean(result.section);
                    const handleClick = () => {
                      if (result.section) {
                        onNavigate(result.section, result.options);
                      }
                    };

                    return (
                      <button
                        key={result.key}
                        type="button"
                        onClick={handleClick}
                        disabled={!isClickable}
                        className={`group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors ${
                          isClickable
                            ? 'hover:bg-dark-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40'
                            : 'opacity-80 cursor-default'
                        }`}
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-dark-700/70 bg-dark-800/80 text-orange-300">
                          <IconComponent size={20} />
                        </span>
                        <div className="flex-1">
                          <div className="font-semibold text-white leading-snug">
                            {renderHighlightedText(result.label)}
                          </div>
                          <div className="mt-1 text-xs text-gray-400 leading-relaxed">
                            {result.description ? renderHighlightedText(result.description) : 'Sans description'}
                          </div>
                        </div>
                        {isClickable && (
                          <ArrowUpRight size={18} className="text-orange-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
