import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, collection, addDoc, updateDoc, deleteDoc, getDocs, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { CirclePlus, List, Settings, LogOut, Edit, User, Send, RefreshCcw, ChevronUp, ChevronDown, Search, Filter, ChevronLeft, Trash2 } from 'lucide-react';

// Firestore Security Rules (This is a conceptual representation for clarity)
// In a real application, these rules are set in the Firebase console,
// but for this environment, we include them here to demonstrate the required configuration.
const FirestoreRules = () => {
    // This is not actual executable code, but a representation of the necessary rules.
    // The rules should be configured in the Firebase console for the project.
    return (
        <code style={{ display: 'none' }}>
{`
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Match all documents under /artifacts/{appId}/public/data/{collection}
    match /artifacts/{appId}/public/data/{collection}/{document} {
      allow read, write: if request.auth != null;
    }

    // Match all documents under /artifacts/{appId}/users/{userId}/{collection}
    match /artifacts/{appId}/users/{userId}/{document} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
`}
        </code>
    );
};

// Global variables provided by the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';

// Function to safely initialize Firebase
function getFirebase() {
    try {
        if (Object.keys(firebaseConfig).length > 0) {
            const app = initializeApp(firebaseConfig);
            const db = getFirestore(app);
            const auth = getAuth(app);
            const storage = getStorage(app);
            return { app, db, auth, storage };
        }
    } catch (error) {
        console.error("Firebase initialization failed:", error);
    }
    return {};
}

const { db, auth, storage } = getFirebase();

// Helper function for exponential backoff on API calls
const withBackoff = async (func, retries = 5, delay = 1000) => {
    try {
        return await func();
    } catch (error) {
        if (retries > 0) {
            console.warn(`API call failed, retrying in ${delay / 1000}s...`, error);
            await new Promise(res => setTimeout(res, delay));
            return withBackoff(func, retries - 1, delay * 2);
        } else {
            throw error;
        }
    }
};

// Main App Component
const App = () => {
    const [user, setUser] = useState(null);
    const [userId, setUserId] = useState(null);
    const [userRole, setUserRole] = useState('end-user'); // Default to end-user
    const [loading, setLoading] = useState(true);
    const [tickets, setTickets] = useState([]);
    const [categories, setCategories] = useState([]);
    const [view, setView] = useState('dashboard'); // 'dashboard', 'create', 'detail', 'admin'
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [modalType, setModalType] = useState('info'); // 'info', 'success', 'error'

    // Dashboard state for filtering and sorting
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'open', 'closed'
    const [filterCategory, setFilterCategory] = useState('all'); // 'all', or categoryId
    const [searchQuery, setSearchQuery] = useState('');
    const [sortKey, setSortKey] = useState('updatedAt'); // 'createdAt', 'updatedAt', 'comments'
    const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'

    // 1. Firebase Auth and Data Listeners
    useEffect(() => {
        const authUnsubscribe = onAuthStateChanged(auth, (authUser) => {
            if (authUser) {
                setUserId(authUser.uid);
                // Listen for user data to get the role
                const userDocRef = doc(db, 'artifacts', appId, 'users', authUser.uid);
                const userUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        setUser(userData);
                        setUserRole(userData.role);
                        setLoading(false);
                    } else {
                        // If user doc doesn't exist, create a basic one.
                        console.log("Creating new user doc...");
                        setDoc(userDocRef, { email: authUser.email, role: 'end-user' })
                            .then(() => {
                                setUser({ email: authUser.email, role: 'end-user' });
                                setUserRole('end-user');
                                setLoading(false);
                            })
                            .catch(e => {
                                console.error("Error creating user doc:", e);
                                setLoading(false);
                            });
                    }
                });
                return () => userUnsubscribe();
            } else {
                setUserId(null);
                setUser(null);
                setUserRole('end-user');
                setLoading(false);
            }
        });

        // Sign in anonymously if no token is available or use custom token
        const signInUser = async () => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (e) {
                console.error("Sign-in failed:", e);
                setLoading(false);
                showNotification('Error during sign-in. Please try again.', 'error');
            }
        };

        if (auth && db) {
            signInUser();

            // Setup listeners for tickets and categories
            const ticketsColRef = collection(db, 'artifacts', appId, 'public', 'data', 'tickets');
            const categoriesColRef = collection(db, 'artifacts', appId, 'public', 'data', 'categories');

            const ticketsUnsubscribe = onSnapshot(ticketsColRef, (snapshot) => {
                const fetchedTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setTickets(fetchedTickets);
            });

            const categoriesUnsubscribe = onSnapshot(categoriesColRef, (snapshot) => {
                const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCategories(fetchedCategories);
            });

            // Cleanup listeners on component unmount
            return () => {
                authUnsubscribe();
                ticketsUnsubscribe();
                categoriesUnsubscribe();
            };
        } else {
            console.error("Firebase services not available.");
            setLoading(false);
        }
    }, [auth, db, initialAuthToken]);

    const showNotification = (message, type = 'info') => {
        setModalMessage(message);
        setModalType(type);
        setShowModal(true);
        setTimeout(() => setShowModal(false), 3000);
    };

    // 2. Data Filtering and Sorting
    const getFilteredTickets = () => {
        let filtered = tickets;
        
        // Filter by user role
        if (userRole === 'end-user') {
            filtered = filtered.filter(ticket => ticket.createdBy === userId);
        }

        // Filter by status
        if (filterStatus !== 'all') {
            filtered = filtered.filter(ticket => ticket.status.toLowerCase() === filterStatus);
        }

        // Filter by category
        if (filterCategory !== 'all') {
            filtered = filtered.filter(ticket => ticket.category === filterCategory);
        }

        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(ticket =>
                ticket.title.toLowerCase().includes(query) ||
                ticket.description.toLowerCase().includes(query)
            );
        }
        
        // Sort the tickets
        filtered.sort((a, b) => {
            let aValue, bValue;
            if (sortKey === 'updatedAt' || sortKey === 'createdAt') {
                aValue = a[sortKey]?.seconds || 0;
                bValue = b[sortKey]?.seconds || 0;
            } else if (sortKey === 'comments') {
                aValue = a.comments?.length || 0;
                bValue = b.comments?.length || 0;
            } else {
                return 0; // No valid sort key
            }
            
            if (sortOrder === 'desc') {
                return bValue - aValue;
            } else {
                return aValue - bValue;
            }
        });
        
        return filtered;
    };

    // 3. UI Components
    const Navbar = () => (
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

    const Modal = ({ message, type }) => (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ease-out p-4 rounded-xl shadow-lg text-white font-medium ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}>
            {message}
        </div>
    );

    const Dashboard = () => {
        const filteredTickets = getFilteredTickets();

        const getStatusColor = (status) => {
            switch(status.toLowerCase()) {
                case 'open': return 'bg-red-500 text-white';
                case 'in progress': return 'bg-yellow-500 text-yellow-900';
                case 'resolved': return 'bg-blue-500 text-white';
                case 'closed': return 'bg-green-500 text-white';
                default: return 'bg-gray-500 text-white';
            }
        };

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

    const CreateTicket = () => {
        const [title, setTitle] = useState('');
        const [description, setDescription] = useState('');
        const [category, setCategory] = useState('');
        const [attachment, setAttachment] = useState(null);
        const [isSubmitting, setIsSubmitting] = useState(false);

        const handleFileChange = (e) => {
            if (e.target.files[0]) {
                setAttachment(e.target.files[0]);
            }
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            if (!title || !description || !category || !userId) {
                showNotification('All fields are required!', 'error');
                return;
            }

            setIsSubmitting(true);
            try {
                let attachmentUrl = null;
                if (attachment) {
                    const storageRef = ref(storage, `artifacts/${appId}/tickets/${uuidv4()}-${attachment.name}`);
                    await uploadBytes(storageRef, attachment);
                    attachmentUrl = await getDownloadURL(storageRef);
                }

                await withBackoff(() => addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tickets'), {
                    title,
                    description,
                    category,
                    status: 'Open',
                    createdBy: userId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    comments: [{
                        text: `Ticket created by ${user?.email || 'User'}.`,
                        createdAt: new Date(),
                        createdBy: userId,
                        isSystem: true,
                        attachmentUrl
                    }],
                }));
                showNotification('Ticket created successfully!', 'success');
                setView('dashboard');
            } catch (error) {
                console.error("Error creating ticket:", error);
                showNotification('Failed to create ticket.', 'error');
            } finally {
                setIsSubmitting(false);
            }
        };

        return (
            <div className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h2 className="text-3xl font-extrabold text-gray-900 mb-6">Create New Ticket</h2>
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md space-y-4">
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
                        <input
                            type="text"
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea
                            id="description"
                            rows="4"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        ></textarea>
                    </div>
                    <div>
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
                        <select
                            id="category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Select a category</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="attachment" className="block text-sm font-medium text-gray-700">Attachment</label>
                        <input
                            type="file"
                            id="attachment"
                            onChange={handleFileChange}
                            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-blue-600 text-white p-3 rounded-xl font-semibold shadow-md hover:bg-blue-700 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isSubmitting ? <RefreshCcw size={20} className="animate-spin mr-2" /> : <Send size={20} className="mr-2" />}
                        {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
                    </button>
                </form>
            </div>
        );
    };

    const TicketDetail = () => {
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

        // Close dropdown when clicking outside
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
                    
                    {/* Conversation Timeline */}
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

                    {/* Reply Form */}
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

    const AdminPanel = () => {
        const [newCategoryName, setNewCategoryName] = useState('');
        const [isSubmitting, setIsSubmitting] = useState(false);

        const handleAddCategory = async (e) => {
            e.preventDefault();
            if (!newCategoryName.trim()) return;
            setIsSubmitting(true);
            try {
                await withBackoff(() => addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), {
                    name: newCategoryName
                }));
                setNewCategoryName('');
                showNotification('Category added successfully!', 'success');
            } catch (error) {
                console.error("Error adding category:", error);
                showNotification('Failed to add category.', 'error');
            } finally {
                setIsSubmitting(false);
            }
        };

        const handleDeleteCategory = async (categoryId) => {
            try {
                await withBackoff(() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', categoryId)));
                showNotification('Category deleted successfully!', 'success');
            } catch (error) {
                console.error("Error deleting category:", error);
                showNotification('Failed to delete category.', 'error');
            }
        };

        return (
            <div className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h2 className="text-3xl font-extrabold text-gray-900 mb-6">Admin Panel</h2>

                {/* Manage Categories */}
                <div className="bg-white p-6 rounded-xl shadow-md mb-6">
                    <h3 className="text-xl font-semibold mb-4">Manage Categories</h3>
                    <form onSubmit={handleAddCategory} className="flex space-x-2 mb-4">
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="New category name"
                            className="flex-1 p-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="submit"
                            disabled={isSubmitting || !newCategoryName.trim()}
                            className="p-3 bg-blue-600 text-white rounded-xl shadow-md hover:bg-blue-700 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? <RefreshCcw className="animate-spin" /> : <CirclePlus />}
                        </button>
                    </form>
                    <ul className="space-y-2">
                        {categories.map(cat => (
                            <li key={cat.id} className="flex items-center justify-between p-2 bg-gray-100 rounded-xl">
                                <span className="text-gray-800">{cat.name}</span>
                                <button onClick={() => handleDeleteCategory(cat.id)} className="p-1 text-red-500 hover:text-red-700">
                                    <Trash2 />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                
                {/* User management section placeholder */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="text-xl font-semibold mb-4">User Management</h3>
                    <p className="text-gray-500">This section would contain tools for managing user roles and permissions. (e.g., changing user roles, deleting users)</p>
                </div>
            </div>
        );
    };

    // 4. Main App Rendering
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 text-gray-500">
                <RefreshCcw className="animate-spin text-4xl mr-2" />
                Loading application...
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-gray-100 text-gray-900 font-sans antialiased flex flex-col pt-20">
            <Navbar />
            {showModal && <Modal message={modalMessage} type={modalType} />}
            <main className="flex-1">
                {view === 'dashboard' && <Dashboard />}
                {view === 'create' && <CreateTicket />}
                {view === 'detail' && <TicketDetail />}
                {view === 'admin' && <AdminPanel />}
            </main>
        </div>
    );
};

export default App;
