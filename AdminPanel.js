import React, { useState } from 'react';
import { CirclePlus, RefreshCcw, Trash2 } from 'lucide-react';
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore';
import { db, appId, withBackoff } from './firebase';

const AdminPanel = ({ categories, showNotification }) => {
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
            
            <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-xl font-semibold mb-4">User Management</h3>
                <p className="text-gray-500">This section would contain tools for managing user roles and permissions. (e.g., changing user roles, deleting users)</p>
            </div>
        </div>
    );
};

export default AdminPanel;