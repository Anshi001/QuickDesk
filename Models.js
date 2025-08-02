import React, { useState } from 'react';
import { Search, Filter, ChevronUp, ChevronDown } from 'lucide-react';
// import TicketDetail from './TicketDetail';

const Dashboard = ({ tickets, categories, userRole, userId, setView, setSelectedTicket }) => {
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortKey, setSortKey] = useState('updatedAt');
    const [sortOrder, setSortOrder] = useState('desc');

    const getStatusColor = (status) => {
        switch(status.toLowerCase()) {
            case 'open': return 'bg-red-500 text-white';
            case 'in progress': return 'bg-yellow-500 text-yellow-900';
            case 'resolved': return 'bg-blue-500 text-white';
            case 'closed': return 'bg-green-500 text-white';
            default: return 'bg-gray-500 text-white';
        }
    };

    const getFilteredTickets = () => {
        let filtered = tickets;
        
        if (userRole === 'end-user') {
            filtered = filtered.filter(ticket => ticket.createdBy === userId);
        }
        if (filterStatus !== 'all') {
            filtered = filtered.filter(ticket => ticket.status.toLowerCase() === filterStatus);
        }
        if (filterCategory !== 'all') {
            filtered = filtered.filter(ticket => ticket.category === filterCategory);
        }
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(ticket =>
                ticket.title.toLowerCase().includes(query) ||
                ticket.description.toLowerCase().includes(query)
            );
        }
        
        filtered.sort((a, b) => {
            let aValue, bValue;
            if (sortKey === 'updatedAt' || sortKey === 'createdAt') {
                aValue = a[sortKey]?.seconds || 0;
                bValue = b[sortKey]?.seconds || 0;
            } else if (sortKey === 'comments') {
                aValue = a.comments?.length || 0;
                bValue = b.comments?.length || 0;
            } else {
                return 0;
            }
            
            if (sortOrder === 'desc') {
                return bValue - aValue;
            } else {
                return aValue - bValue;
            }
        });
        
        return filtered;
    };

    const filteredTickets = getFilteredTickets();

    return (
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-6">Dashboard</h2>
            <div className="flex flex-col sm:flex-row items-center justify-between mb-6 space-y-4 sm:space-y-0">
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <Search size={20} className="text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search tickets..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 p-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
                    <div className="relative w-full sm:w-auto">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="appearance-none p-2 border border-gray-300 rounded-xl w-full sm:w-auto pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Statuses</option>
                            <option value="open">Open</option>
                            <option value="in progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                        </select>
                        <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    </div>
                    <div className="relative w-full sm:w-auto">
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="appearance-none p-2 border border-gray-300 rounded-xl w-full sm:w-auto pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Categories</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                        <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    </div>
                    <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Sort by:</label>
                        <button
                            onClick={() => {
                                setSortKey('updatedAt');
                                setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                            }}
                            className={`p-2 rounded-xl text-sm font-medium transition-all duration-200 ${sortKey === 'updatedAt' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                        >
                            Updated {sortOrder === 'desc' && sortKey === 'updatedAt' ? <ChevronUp className="inline-block" size={16} /> : <ChevronDown className="inline-block" size={16} />}
                        </button>
                        <button
                            onClick={() => {
                                setSortKey('comments');
                                setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                            }}
                            className={`p-2 rounded-xl text-sm font-medium transition-all duration-200 ${sortKey === 'comments' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                        >
                            Replies {sortOrder === 'desc' && sortKey === 'comments' ? <ChevronUp className="inline-block" size={16} /> : <ChevronDown className="inline-block" size={16} />}
                        </button>
                    </div>
                </div>
            </div>
            {userId && (
                <div className="mt-4 p-4 text-sm text-gray-700 bg-white rounded-xl shadow-md">
                    <span className="font-semibold">Current User ID:</span> {userId}
                </div>
            )}
            {filteredTickets.length > 0 ? (
                <ul className="space-y-4">
                    {filteredTickets.map(ticket => (
                        <li key={ticket.id} className="p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer" onClick={() => { setSelectedTicket(ticket); setView('detail'); }}>
                            <div className="flex items-start justify-between mb-2">
                                <h3 className="text-lg font-semibold text-gray-900 truncate pr-4">{ticket.title}</h3>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full min-w-[80px] text-center ${getStatusColor(ticket.status)}`}>
                                    {ticket.status}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2">{ticket.description}</p>
                            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                <span>Category: <span className="font-semibold">{categories.find(c => c.id === ticket.category)?.name || 'N/A'}</span></span>
                                <span>Last Updated: {new Date(ticket.updatedAt?.seconds * 1000).toLocaleString()}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="p-8 text-center text-gray-500 bg-white rounded-xl shadow-md">
                    No tickets found.
                </div>
            )}
        </div>
    );
};

export default Dashboard;