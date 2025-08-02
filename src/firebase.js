import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

export { db, auth, storage, appId, initialAuthToken };

// Helper function for exponential backoff on API calls
export const withBackoff = async (func, retries = 5, delay = 1000) => {
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