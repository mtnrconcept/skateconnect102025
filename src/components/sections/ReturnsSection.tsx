import React from 'react';

export default function ReturnsSection() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Retours et annulations</h1>
        <p className="mt-1 text-sm text-slate-300">
          Politique de retours, échanges et annulations pour les achats réalisés via la Boutique SkateConnect.
        </p>
      </header>

      <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-200">
        <section>
          <h2 className="text-lg font-semibold text-white">Délai de rétractation</h2>
          <p className="mt-1 text-slate-300">
            Vous disposez d’un délai de 14 jours calendaires à compter de la réception du produit pour exercer votre droit de
            rétractation, sans justification ni pénalité, conformément au Code de la consommation (UE). Certains produits
            personnalisés ou scellés ne sont pas éligibles.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">Procédure de retour</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-300">
            <li>Contactez le support via l’e‑mail indiqué sur votre reçu Stripe pour obtenir une étiquette de retour.</li>
            <li>Les produits doivent être non utilisés, complets et dans leur emballage d’origine.</li>
            <li>À réception et vérification, un remboursement est initié sur le moyen de paiement d’origine.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">Échanges</h2>
          <p className="mt-1 text-slate-300">
            Les échanges (taille/couleur) sont possibles sous réserve de disponibilité. À défaut, un remboursement sera proposé.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">Annulation de commande</h2>
          <p className="mt-1 text-slate-300">
            Tant que la commande n’est pas expédiée, vous pouvez demander une annulation via le lien de reçu Stripe ou en
            répondant à l’e‑mail de confirmation. Les commandes déjà remises au transporteur ne peuvent plus être annulées.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">Produits défectueux ou non conformes</h2>
          <p className="mt-1 text-slate-300">
            Si l’article est défectueux ou non conforme, prenez contact sous 48h avec des photos. Les frais de retour sont à
            la charge du vendeur en cas de défaut avéré.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">Frais et délais</h2>
          <p className="mt-1 text-slate-300">
            Selon le motif, les frais de retour peuvent s’appliquer. Les délais de remboursement sont généralement de 5 à 10
            jours ouvrés après validation du retour (dépend du réseau bancaire/Stripe).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">Contact</h2>
          <p className="mt-1 text-slate-300">
            Pour toute question, répondez directement à l’e‑mail de confirmation de paiement Stripe (reçu) ou utilisez la
            section Contact de la marque partenaire indiquée sur la page produit.
          </p>
        </section>
      </div>
    </div>
  );
}

