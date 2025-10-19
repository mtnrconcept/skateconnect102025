import { MapPin, Camera, Calendar } from 'lucide-react';

interface AddSectionProps {
  onNavigate: (section: 'map' | 'feed') => void;
}

export default function AddSection({ onNavigate }: AddSectionProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Ajouter du contenu</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          onClick={() => onNavigate('map')}
          className="bg-white rounded-xl border-2 border-slate-200 p-8 hover:border-blue-500 hover:shadow-lg transition-all group"
        >
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-500 transition-colors">
            <MapPin size={32} className="text-blue-600 group-hover:text-white transition-colors" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Ajouter un Spot</h3>
          <p className="text-slate-600">Partagez un nouveau spot de skate avec la communauté</p>
        </button>

        <button
          onClick={() => onNavigate('feed')}
          className="bg-white rounded-xl border-2 border-slate-200 p-8 hover:border-cyan-500 hover:shadow-lg transition-all group"
        >
          <div className="w-16 h-16 mx-auto mb-4 bg-cyan-100 rounded-full flex items-center justify-center group-hover:bg-cyan-500 transition-colors">
            <Camera size={32} className="text-cyan-600 group-hover:text-white transition-colors" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Créer un Post</h3>
          <p className="text-slate-600">Partagez vos sessions et tricks avec photos/vidéos</p>
        </button>

        <div className="bg-white rounded-xl border-2 border-slate-200 p-8 opacity-50 cursor-not-allowed">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
            <Calendar size={32} className="text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Organiser un Événement</h3>
          <p className="text-slate-600">Créez une session ou un contest</p>
          <span className="inline-block mt-2 text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full">
            Bientôt disponible
          </span>
        </div>
      </div>
    </div>
  );
}
