import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, UserPlus } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: () => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        onAuthSuccess();
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) throw signUpError;

        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').insert({
            id: data.user.id,
            username,
            display_name: displayName,
          });

          if (profileError) throw profileError;
          onAuthSuccess();
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Une erreur est survenue');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-dark-800 rounded-2xl shadow-2xl overflow-hidden border border-dark-700">
          <div className="bg-dark-800 px-8 py-12 text-center border-b border-dark-700">
            <div className="flex justify-center mb-4">
              <img src="/logo.png" alt="Shredloc" className="h-16 w-auto" />
            </div>
            <h1 className="sr-only">Shredloc</h1>
            <p className="text-gray-400">Le réseau social des skateboarders</p>
          </div>

          <div className="p-8">
            <div className="flex gap-2 mb-6">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors ${
                  isLogin
                    ? 'bg-orange-500 text-white'
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors ${
                  !isLogin
                    ? 'bg-orange-500 text-white'
                    : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                }`}
              >
                Inscription
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow placeholder-gray-500"
                  placeholder="votre@email.com"
                />
              </div>

              {!isLogin && (
                <>
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-400 mb-1.5">
                      Nom d'utilisateur
                    </label>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow placeholder-gray-500"
                      placeholder="skater123"
                    />
                  </div>

                  <div>
                    <label htmlFor="displayName" className="block text-sm font-medium text-gray-400 mb-1.5">
                      Nom d'affichage
                    </label>
                    <input
                      id="displayName"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow placeholder-gray-500"
                      placeholder="Votre nom"
                    />
                  </div>
                </>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-1.5">
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-dark-700 border border-dark-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow placeholder-gray-500"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 text-white py-3 rounded-lg font-medium hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>Chargement...</span>
                ) : isLogin ? (
                  <>
                    <LogIn size={20} />
                    <span>Se connecter</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={20} />
                    <span>S'inscrire</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
