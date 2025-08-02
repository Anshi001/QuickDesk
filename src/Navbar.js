import React from 'react';
import { LogOut, List, CirclePlus, Settings } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';

const Navbar = ({ user, userRole, setView, userId }) => (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-lg p-4 flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">Help Desk</h1>
        <div className="flex items-center space-x-4">
            {userId && (
                <div className="hidden md:flex flex-col items-end text-sm text-gray-600">
                    <span>Logged in as: <span className="font-semibold">{user?.email || 'Guest'}</span></span>
                    <span className="text-xs text-gray-500">Role: <span className="font-semibold capitalize">{userRole}</span></span>
                </div>
            )}
            {userRole !== 'end-user' && (
                <button onClick={() => setView('dashboard')} className="p-2 rounded-full text-gray-600 hover:bg-gray-100">
                    <List size={20} />
                </button>
            )}
            {userRole === 'end-user' && (
                <button onClick={() => setView('create')} className="p-2 rounded-full text-gray-600 hover:bg-gray-100">
                    <CirclePlus size={20} />
                </button>
            )}
            {userRole === 'admin' && (
                <button onClick={() => setView('admin')} className="p-2 rounded-full text-gray-600 hover:bg-gray-100">
                    <Settings size={20} />
                </button>
            )}
            <button onClick={() => signOut(auth)} className="p-2 rounded-full text-gray-600 hover:bg-gray-100">
                <LogOut size={20} />
            </button>
        </div>
    </nav>
);

export default Navbar;