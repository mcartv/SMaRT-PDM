const API_URL = 'http://localhost:5000/api/auth';

export const authService = {
    login: async (email, password, rememberMe) => {
        try {
            const response = await fetch('http://localhost:5000/api/auth/login', { // <-- UPDATE THIS LINE
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, rememberMe })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Invalid credentials');
            }

            return data;
        } catch (error) {
            console.error("Auth Service Error:", error);
            throw error;
        }
    },

    logout: () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminProfile');
        window.location.href = '/login';
    }
};