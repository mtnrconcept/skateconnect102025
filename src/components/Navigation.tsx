import { Map, Home, CalendarDays, Trophy, User, Settings, Mail, Handshake } from 'lucide-react';
import type { Section } from '../types';

interface NavigationProps {
  currentSection: Section;
  onSectionChange: (section: Section) => void;
}

export default function Navigation({ currentSection, onSectionChange }: NavigationProps) {
  const navItems = [
    { id: 'map' as Section, icon: Map, label: 'Carte' },
    { id: 'feed' as Section, icon: Home, label: 'Feed' },
    { id: 'events' as Section, icon: CalendarDays, label: 'Événements' },
    { id: 'challenges' as Section, icon: Trophy, label: 'Défis' },
    { id: 'sponsors' as Section, icon: Handshake, label: 'Sponsors' },
    { id: 'messages' as Section, icon: Mail, label: 'Messages' },
    { id: 'profile' as Section, icon: User, label: 'Profil' },
    { id: 'settings' as Section, icon: Settings, label: 'Paramètres' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-dark-800 border-t border-dark-700 z-50 md:hidden">
      <div className="flex items-center h-16 overflow-x-auto px-2 gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`flex flex-col items-center justify-center min-w-[72px] flex-1 h-full rounded-2xl transition-colors border ${
                isActive
                  ? 'bg-dark-700 text-orange-400 border-orange-500/40'
                  : 'bg-transparent text-gray-400 border-transparent hover:text-gray-200 hover:bg-dark-700/60'
              }`}
            >
              <Icon size={22} className={isActive ? 'stroke-2' : 'stroke-1.5'} />
              <span className="text-[11px] mt-1 font-medium leading-tight text-center">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
