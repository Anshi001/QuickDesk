import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Edit, User, Send, RefreshCcw } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db, appId, withBackoff } from './firebase';

const TicketDetail = ({ selectedTicket, userId, userRole, setView, showNotification, categories, user }) => {
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showStatusMenu, setShowStatusMenu] = useState(false);
    const statusMenuRef = useRef(null);

    const getStatusColor = (status) => {
        switch(status.toLowerCase()) {
            case 'open': return 'bg-red-500 text-white';
            case 'in progress': return 'bg-yellow-500 text-yellow-900';
            case 'resolved': return 'bg-blue-500 text-white';
            case 'closed': return 'bg-green-500 text-white';
            default: return 'bg-gray-500 text-white';
        }
    };

    const handleUpdateStatus = async (newStatus) => {
        setIsSubmitting(true);
        try {
            const ticketRef = doc(db, 'artifacts', appId, 'public', 'data', 'tickets', selectedTicket.id);
            await withBackoff(() => updateDoc(ticketRef, {
                status: newStatus,
                updatedAt: new Date(),
                comments: [...selectedTicket.comments, {
                    text: `Status changed to '${newStatus}' by ${user?.email || 'User'}.`,
                    createdAt: new Date(),
                    createdBy: userId,
                    isSystem: true
                }],
            }));
            showNotification('Ticket status updated!', 'success');
        } catch (error) {
            console.error("Error updating status:", error);
            showNotification('Failed to update ticket status.', 'error');
        } finally {
            setIsSubmitting(false);
            setShowStatusMenu(false);
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        setIsSubmitting(true);
        try {
            const ticketRef = doc(db, 'artifacts', appId, 'public', 'data', 'tickets', selectedTicket.id);
            await withBackoff(() => updateDoc(ticketRef, {
                updatedAt: new Date(),
                comments: [...selectedTicket.comments, {
                    text: newComment,
                    createdAt: new Date(),
                    createdBy: userId,
                    isSystem: false
                }],
            }));
            setNewComment('');
            showNotification('Comment added!', 'success');
        } catch (error) {
            console.error("Error adding comment:", error);
            showNotification('Failed to add comment.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (statusMenuRef.current && !statusMenuRef.current.contains(event.target)) {
                setShowStatusMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [statusMenuRef]);

    if (!selectedTicket) {
        return <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">Ticket not found.</div>;
    }

    const canReply = userRole !== 'admin' || selectedTicket.createdBy === userId;

    return (
        <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <button onClick={() => setView('dashboard')} className="mb-6 flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors duration-200">
                <ChevronLeft size={20} />
                <span>Back to Dashboard</span>
            </button>
            <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">{selectedTicket.title}</h2>
                    <div className="flex items-center space-x-2 mt-2 sm:mt-0 relative">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(selectedTicket.status)}`}>
                            {selectedTicket.status}
                        </span>
                        {(userRole === 'support-agent' || userRole === 'admin') && (
                            <div ref={statusMenuRef}>
                                <button
                                    onClick={() => setShowStatusMenu(!showStatusMenu)}
                                    className="p-2 rounded-xl bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors duration-200"
                                >
                                    <Edit />
                                </button>
                                {showStatusMenu && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-10">
                                        <button onClick={() => handleUpdateStatus('Open')} className="block w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100">Open</button>
                                        <button onClick={() => handleUpdateStatus('In Progress')} className="block w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100">In Progress</button>
                                        <button onClick={() => handleUpdateStatus('Resolved')} className="block w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100">Resolved</button>
                                        <button onClick={() => handleUpdateStatus('Closed')} className="block w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100">Closed</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="text-sm text-gray-500 mb-4 border-b pb-4">
                    <p>Category: <span className="font-semibold">{categories.find(c => c.id === selectedTicket.category)?.name || 'N/A'}</span></p>
                    <p>Created by: <span className="font-semibold">{selectedTicket.createdBy || 'Unknown'}</span></p>
                    <p>Created on: {new Date(selectedTicket.createdAt?.seconds * 1000).toLocaleString()}</p>
                </div>
                <p className="text-gray-700 mb-6">{selectedTicket.description}</p>
                
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Conversation</h3>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {selectedTicket.comments?.map((comment, index) => (
                        <div key={index} className={`flex ${comment.createdBy === userId ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-4 max-w-[80%] rounded-xl shadow-sm ${comment.isSystem ? 'bg-gray-100 text-gray-700' : comment.createdBy === userId ? 'bg-blue-100 text-blue-900' : 'bg-gray-200 text-gray-800'}`}>
                                <div className="flex items-center space-x-2 text-sm mb-1">
                                    <User />
                                    <span className="font-semibold">{comment.isSystem ? 'System' : (comment.createdBy === userId ? 'You' : 'Support Agent')}</span>
                                    <span className="text-xs text-gray-500">{new Date(comment.createdAt?.seconds * 1000).toLocaleString()}</span>
                                </div>
                                <p className="text-sm">{comment.text}</p>
                                {comment.attachmentUrl && (
                                    <a href={comment.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-xs mt-2 block">
                                        View Attachment
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {canReply && (
                    <form onSubmit={handleAddComment} className="mt-6 flex items-center space-x-2">
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="flex-1 p-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            rows="2"
                            placeholder="Add a comment..."
                        />
                        <button
                            type="submit"
                            disabled={isSubmitting || !newComment.trim()}
                            className="p-3 bg-blue-600 text-white rounded-xl shadow-md hover:bg-blue-700 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? <RefreshCcw className="animate-spin" /> : <Send />}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default TicketDetail;