import { ReactNode } from 'react';
type User = {
    id: string;
    email: string;
    role: 'admin' | 'superadmin';
};
type AuthContextType = {
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    loading: boolean;
};
declare const AuthContext: import("react").Context<AuthContextType | undefined>;
export declare const AuthProvider: ({ children }: {
    children: ReactNode;
}) => import("react/jsx-runtime").JSX.Element;
export declare const useAuth: () => AuthContextType;
export default AuthContext;
