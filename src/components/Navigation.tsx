import { Map, Home, CalendarDays, Trophy, User, Settings, Mail } from 'lucide-react';
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
    { id: 'messages' as Section, icon: Mail, label: 'Messages' },
    { id: 'profile' as Section, icon: User, label: 'Profil' },
    { id: 'settings' as Section, icon: Settings, label: 'Paramètres' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-dark-800 border-t border-dark-700 z-50 md:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors relative ${
                isActive
                  ? 'text-orange-500'
                  : 'text-gray-500 hover:text-gray-400'
              }`}
            >
              {isActive && item.id === 'feed' ? (
                <div className="absolute inset-x-0 flex flex-col items-center justify-center">
                  <div className="bg-orange-500 rounded-full px-6 py-2">
                    <span className="text-white text-sm font-semibold">Feed</span>
                  </div>
                </div>
              ) : (
                <>
                  <Icon size={24} className={isActive ? 'stroke-2' : 'stroke-1.5'} />
                  <span className="text-xs mt-1 font-medium">{item.label}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
