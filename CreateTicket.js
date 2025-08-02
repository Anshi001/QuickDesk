import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { addDoc, collection } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Send, RefreshCcw } from 'lucide-react';
import { db, storage, appId, withBackoff } from './firebase';

const CreateTicket = ({ categories, userId, user, setView, showNotification }) => {
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

export default CreateTicket;