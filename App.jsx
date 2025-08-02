import React, { useState, useEffect } from 'react';
import { signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, doc, collection, setDoc } from 'firebase/firestore';
import { RefreshCcw } from 'lucide-react';

// Import components and firebase setup
import { db, auth, appId, initialAuthToken } from './firebase';
import Navbar from './Navbar';
import Modal from './Modal';
import Dashboard from './Dashboard';
import CreateTicket from './CreateTicket';
import TicketDetail from './TicketDetail';
import AdminPanel from './AdminPanel';

// Firestore Security Rules (This is a conceptual representation for clarity)
const FirestoreRules = () => {
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


const App = () => {
    const [user, setUser] = useState(null);
    const [userId, setUserId] = useState(null);
    const [userRole, setUserRole] = useState('end-user');
    const [loading, setLoading] = useState(true);
    const [tickets, setTickets] = useState([]);
    const [categories, setCategories] = useState([]);
    const [view, setView] = useState('dashboard');
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [modalType, setModalType] = useState('info');

    const showNotification = (message, type = 'info') => {
        setModalMessage(message);
        setModalType(type);
        setShowModal(true);
        setTimeout(() => setShowModal(false), 3000);
    };

    useEffect(() => {
        const authUnsubscribe = onAuthStateChanged(auth, (authUser) => {
            if (authUser) {
                setUserId(authUser.uid);
                const userDocRef = doc(db, 'artifacts', appId, 'users', authUser.uid);
                const userUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        setUser(userData);
                        setUserRole(userData.role);
                        setLoading(false);
                    } else {
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
            <Navbar user={user} userRole={userRole} setView={setView} userId={userId} />
            {showModal && <Modal message={modalMessage} type={modalType} />}
            <main className="flex-1">
                {view === 'dashboard' && (
                    <Dashboard
                        tickets={tickets}
                        categories={categories}
                        userRole={userRole}
                        userId={userId}
                        setView={setView}
                        setSelectedTicket={setSelectedTicket}
                    />
                )}
                {view === 'create' && (
                    <CreateTicket
                        categories={categories}
                        userId={userId}
                        user={user}
                        setView={setView}
                        showNotification={showNotification}
                    />
                )}
                {view === 'detail' && (
                    <TicketDetail
                        selectedTicket={selectedTicket}
                        userId={userId}
                        userRole={userRole}
                        setView={setView}
                        showNotification={showNotification}
                        categories={categories}
                        user={user}
                    />
                )}
                {view === 'admin' && (
                    <AdminPanel
                        categories={categories}
                        showNotification={showNotification}
                    />
                )}
            </main>
        </div>
    );
};

export default App;
