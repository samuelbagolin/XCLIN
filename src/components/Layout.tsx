import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Calendar as CalendarIcon, 
  Stethoscope, 
  DollarSign, 
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';

export function Layout({ children }: { children: React.ReactNode }) {
  const { profile, clinic, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'professional', 'receptionist'] },
    { to: '/patients', icon: Users, label: 'Pacientes', roles: ['admin', 'professional', 'receptionist'] },
    { to: '/calendar', icon: CalendarIcon, label: 'Agenda', roles: ['admin', 'professional', 'receptionist'] },
    { to: '/professionals', icon: Stethoscope, label: 'Profissionais', roles: ['admin', 'receptionist'] },
    { to: '/financial', icon: DollarSign, label: 'Financeiro', roles: ['admin'] },
    { to: '/settings', icon: SettingsIcon, label: 'Configurações', roles: ['admin'] },
  ];

  const filteredNavItems = navItems.filter(item => 
    !item.roles || item.roles.includes(profile?.role || '')
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex font-sans transition-colors duration-300">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 bg-sky-600 rounded-xl overflow-hidden flex items-center justify-center text-white shrink-0 shadow-sm shadow-sky-600/20">
              {clinic?.logoUrl ? (
                <img src={clinic.logoUrl} alt={clinic.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Stethoscope size={24} />
              )}
            </div>
            <span className="font-bold text-xl text-slate-800 dark:text-white truncate tracking-tight">{clinic?.name || 'XCLIN'}</span>
          </div>
          <button 
            onClick={toggleTheme}
            className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-lg transition-colors"
            title={theme === 'light' ? 'Mudar para modo escuro' : 'Mudar para modo claro'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all
                ${isActive 
                  ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'}
              `}
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold uppercase transition-colors">
              {profile?.displayName?.charAt(0) || profile?.email?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{profile?.displayName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate capitalize">{profile?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar - Mobile */}
        <header className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center justify-between transition-colors duration-300">
          <div className="flex items-center gap-3">
             {clinic?.logoUrl ? (
              <img src={clinic.logoUrl} alt={clinic.name} className="w-8 h-8 object-contain rounded" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 bg-sky-600 rounded flex items-center justify-center text-white font-bold">X</div>
            )}
            <span className="font-bold text-lg text-slate-800 dark:text-white">{clinic?.name || 'XCLIN'}</span>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={toggleTheme}
              className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <Menu size={24} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={window.location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 border-r dark:border-slate-800 z-50 md:hidden flex flex-col shadow-2xl transition-colors duration-300"
            >
              <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                <span className="font-bold text-xl text-sky-600">XCLIN</span>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                >
                  <X size={24} />
                </button>
              </div>
              <nav className="flex-1 px-4 py-6 space-y-1">
                {filteredNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-4 py-4 rounded-xl text-base font-medium transition-colors
                      ${isActive 
                        ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'}
                    `}
                  >
                    <item.icon size={22} />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="p-6 border-t border-slate-100 dark:border-slate-800">
                 <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-4 text-base font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                >
                  <LogOut size={22} />
                  Sair
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
