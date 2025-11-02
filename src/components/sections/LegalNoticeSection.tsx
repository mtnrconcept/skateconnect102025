import React from 'react';

export default function LegalNoticeSection() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Mentions légales</h1>
        <p className="mt-1 text-sm text-slate-300">Informations légales et RGPD applicables à SkateConnect.</p>
      </header>

      <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-200">
        <section>
          <h2 className="text-lg font-semibold text-white">Éditeur du site</h2>
          <p className="mt-1 text-slate-300">
            SkateConnect – Plateforme communautaire pour riders et sponsors. Contact: support@skateconnect.app
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">Hébergement</h2>
          <p className="mt-1 text-slate-300">Hébergeur cloud (infrastructure européenne). Détails disponibles sur demande.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">Protection des données (RGPD)</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-300">
            <li>Finalités: gestion de compte, interactions sociales, boutique, analytics d’usage.</li>
            <li>Bases légales: exécution du contrat (CGU), intérêt légitime (sécurité), consentement (notifications).</li>
            <li>Droits: accès, rectification, effacement, opposition, portabilité – via les paramètres du compte ou contact.</li>
            <li>Conservation: durée du compte, obligations légales et garanties commerciales.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">Cookies et traceurs</h2>
          <p className="mt-1 text-slate-300">
            Nous utilisons des cookies techniques et, le cas échéant, de mesure d’audience. Votre consentement est requis pour
            tout cookie non essentiel. Vous pouvez gérer vos préférences à tout moment.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">Propriété intellectuelle</h2>
          <p className="mt-1 text-slate-300">
            Les contenus (textes, logos, visuels) demeurent la propriété de leurs auteurs/ayants droit. Toute reproduction non
            autorisée est interdite.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">Contact DPO</h2>
          <p className="mt-1 text-slate-300">Pour toute demande RGPD, contactez: privacy@skateconnect.app</p>
        </section>
      </div>
    </div>
  );
}

