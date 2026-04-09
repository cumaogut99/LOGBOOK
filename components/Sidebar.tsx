import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { navItems } from '../constants';

const Sidebar: React.FC = () => {
    const { user, logout } = useAuth();

    if (!user) return null;

    const accessibleNavItems = navItems.filter(item => item.allowedRoles.includes(user.role));

    return (
        <div className="bg-brand-card border-r border-brand-border h-screen w-64 flex flex-col p-4 fixed">
            <div className="flex items-center mb-10 p-2">
                <div className="bg-brand-primary h-8 w-8 rounded-md mr-3 flex-shrink-0"></div>
                <h1 className="text-xl font-bold text-white">PM Logbook</h1>
            </div>
            <nav className="flex-grow">
                <ul>
                    {accessibleNavItems.map(item => (
                        <li key={item.path}>
                            <NavLink
                                to={item.path}
                                end={item.path === '/'}
                                className={({ isActive }) =>
                                    `flex items-center px-4 py-2.5 my-1 text-sm font-medium rounded-md transition-colors ${
                                    isActive
                                        ? 'bg-brand-primary text-white'
                                        : 'text-brand-light hover:bg-brand-dark hover:text-white'
                                    }`
                                }
                            >
                                <item.icon className="h-5 w-5 mr-3" />
                                {item.name}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>
            <div className="border-t border-brand-border pt-4">
                <div className="px-4">
                    <p className="text-white text-sm font-semibold">{user.fullName}</p>
                    <p className="text-xs text-brand-light">{user.role}</p>
                </div>
                <button 
                    onClick={logout} 
                    className="w-full mt-4 flex items-center px-4 py-2.5 text-sm font-medium rounded-md text-brand-light hover:bg-brand-dark hover:text-white"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-3"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Çıkış Yap
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
