import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';
import {
  getUserProfile,
  getManagerProfile,
  getIOSUserProfile,
  signIn as apiSignIn,
  signUp as apiSignUp,
  signOut as apiSignOut,
  ensureUserProfile,
} from '../api/auth';
import type { User, ManagerProfile, IOSUserProfile, SignUpData, SignInData, UserRole } from '../types';

interface SignUpResult {
  user: SupabaseUser | null;
  session: Session | null;
  needsEmailConfirmation: boolean;
}

type ActiveRole = 'ios_user' | 'manager' | 'admin';

interface AuthContextType {
  session: Session | null;
  authUser: SupabaseUser | null;
  user: User | null;
  managerProfile: ManagerProfile | null;
  iosUserProfile: IOSUserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (data: SignUpData) => Promise<SignUpResult>;
  signIn: (data: SignInData) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  userRole: UserRole | null;
  hasCompletedProfile: boolean;
  isRegistering: boolean;
  setIsRegistering: (value: boolean) => void;
  // Multi-role support
  activeRole: ActiveRole | null;
  setActiveRole: (role: ActiveRole) => void;
  availableRoles: ActiveRole[];
  hasMultipleRoles: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [managerProfile, setManagerProfile] = useState<ManagerProfile | null>(null);
  const [iosUserProfile, setIOSUserProfile] = useState<IOSUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);

  // Initialize activeRole from sessionStorage if available
  const [activeRole, setActiveRoleState] = useState<ActiveRole | null>(() => {
    const saved = sessionStorage.getItem('activeRole');
    return saved as ActiveRole | null;
  });

  // Wrapper to persist activeRole to sessionStorage
  const setActiveRole = (role: ActiveRole | null) => {
    setActiveRoleState(role);
    if (role) {
      sessionStorage.setItem('activeRole', role);
    } else {
      sessionStorage.removeItem('activeRole');
    }
  };

  const loadingRef = useRef(false);
  const initializedRef = useRef(false);

  // Helper to check if a role is valid for the user's profiles
  const isValidRoleForUser = (
    role: ActiveRole,
    userProfile: User | null,
    mgrProfile: ManagerProfile | null,
    iosProfile: IOSUserProfile | null
  ): boolean => {
    switch (role) {
      case 'admin':
        return userProfile?.role === 'admin';
      case 'manager':
        return mgrProfile !== null;
      case 'ios_user':
        return iosProfile !== null;
      default:
        return false;
    }
  };

  const loadUserData = async (supabaseUser: SupabaseUser, accessToken?: string): Promise<void> => {
    if (loadingRef.current) {
      console.log('loadUserData: already loading, skipping');
      return;
    }
    loadingRef.current = true;
    console.log('loadUserData: starting for user', supabaseUser.id, 'token:', accessToken ? 'present' : 'missing');

    try {
      let userProfile = await getUserProfile(supabaseUser.id, accessToken);
      console.log('loadUserData: getUserProfile result:', userProfile);

      if (!userProfile && supabaseUser.email) {
        const metadata = supabaseUser.user_metadata || {};
        const username = metadata.username || supabaseUser.email.split('@')[0];
        const role = (metadata.role as UserRole) || 'ios_user';
        console.log('loadUserData: creating user profile with:', { username, role });
        userProfile = await ensureUserProfile(supabaseUser.id, supabaseUser.email, username, role, accessToken);
        console.log('loadUserData: ensureUserProfile result:', userProfile);
      }

      setUser(userProfile);

      // Load BOTH profiles regardless of primary role
      // A manager can also be an iOS user
      const [mgrProfile, iosProfile] = await Promise.all([
        getManagerProfile(supabaseUser.id, accessToken),
        getIOSUserProfile(supabaseUser.id, accessToken),
      ]);

      setManagerProfile(mgrProfile);
      setIOSUserProfile(iosProfile);

      // Set active role logic:
      // 1. Check for admin login flag (from /admin/login page)
      // 2. Respect existing activeRole from sessionStorage (e.g., admin stays admin)
      // 3. Otherwise, determine based on available profiles

      const isAdminLogin = sessionStorage.getItem('adminLogin') === 'true';
      const currentSavedRole = sessionStorage.getItem('activeRole') as ActiveRole | null;

      let newActiveRole: ActiveRole | null = null;

      if (isAdminLogin && userProfile?.role === 'admin') {
        // Explicit admin login - prioritize admin role
        newActiveRole = 'admin';
        sessionStorage.removeItem('adminLogin');
      } else if (currentSavedRole === 'admin' && userProfile?.role === 'admin') {
        // Already set to admin and user is admin - keep it
        newActiveRole = 'admin';
      } else if (currentSavedRole && isValidRoleForUser(currentSavedRole, userProfile, mgrProfile, iosProfile)) {
        // Respect the saved role if it's still valid for this user
        newActiveRole = currentSavedRole;
      } else if (iosProfile && mgrProfile) {
        // Has both - default to iOS user view
        newActiveRole = 'ios_user';
      } else if (iosProfile) {
        newActiveRole = 'ios_user';
      } else if (mgrProfile) {
        newActiveRole = 'manager';
      } else if (userProfile?.role === 'admin') {
        newActiveRole = 'admin';
      } else {
        // No profile yet - use their registered role
        newActiveRole = (userProfile?.role as ActiveRole) || null;
      }

      console.log('loadUserData complete:', {
        userProfile: userProfile?.email,
        mgrProfile: mgrProfile?.full_name,
        iosProfile: iosProfile?.full_name,
        currentSavedRole,
        newActiveRole,
      });

      setActiveRole(newActiveRole);
    } catch (error) {
      console.error('loadUserData error:', error);
    } finally {
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let mounted = true;

    const init = async () => {
      try {
        console.log('Auth init: getting session...');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        console.log('Auth init: session:', currentSession ? 'exists' : 'null');

        if (!mounted) return;

        setSession(currentSession);
        setAuthUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          console.log('Auth init: loading user data...');
          await loadUserData(currentSession.user, currentSession.access_token);
        }
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        console.log('Auth init: complete, setting isLoading to false');
        if (mounted) setIsLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        console.log('Auth event:', event);

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setAuthUser(null);
          setUser(null);
          setManagerProfile(null);
          setIOSUserProfile(null);
          setActiveRole(null);
          sessionStorage.removeItem('adminLogin');
          sessionStorage.removeItem('activeRole');
          return;
        }

        if (event === 'SIGNED_IN' && newSession?.user) {
          setSession(newSession);
          setAuthUser(newSession.user);

          // Always load user data on sign in - reset the loading ref first
          loadingRef.current = false;
          setIsLoading(true);
          console.log('SIGNED_IN: Loading user data with token...');
          await loadUserData(newSession.user, newSession.access_token);
          console.log('SIGNED_IN: User data loaded, setting isLoading to false');
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (data: SignUpData): Promise<SignUpResult> => {
    setIsLoading(true);
    setIsRegistering(true);
    try {
      const result = await apiSignUp(data);

      if (result.session && result.user) {
        const userProfile = await ensureUserProfile(result.user.id, data.email, data.username, data.role);
        setUser(userProfile);
        setSession(result.session);
        setAuthUser(result.user);
        setActiveRole(data.role as ActiveRole);
      }

      return {
        user: result.user,
        session: result.session,
        needsEmailConfirmation: result.needsEmailConfirmation ?? false,
      };
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (data: SignInData) => {
    setIsLoading(true);
    setIsRegistering(false);
    try {
      await apiSignIn(data);
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    setIsRegistering(false);
    try {
      await apiSignOut();
      setUser(null);
      setManagerProfile(null);
      setIOSUserProfile(null);
      setActiveRole(null);
      // Clear any persisted flags
      sessionStorage.removeItem('adminLogin');
      sessionStorage.removeItem('activeRole');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (authUser && session) {
      // Reset loading ref to allow refresh
      loadingRef.current = false;
      await loadUserData(authUser, session.access_token);
    }
  };

  // Compute available roles
  const availableRoles: ActiveRole[] = [];
  if (iosUserProfile) availableRoles.push('ios_user');
  if (managerProfile) availableRoles.push('manager');
  if (user?.role === 'admin') availableRoles.push('admin');

  const hasMultipleRoles = availableRoles.length > 1;

  // Use active role for determining current role context
  const userRole = activeRole || user?.role || null;

  const hasCompletedProfile = Boolean(
    user && ((activeRole === 'manager' && managerProfile) || (activeRole === 'ios_user' && iosUserProfile) || activeRole === 'admin')
  );

  const isAuthenticated = Boolean(session && user && !isRegistering);

  return (
    <AuthContext.Provider
      value={{
        session, authUser, user, managerProfile, iosUserProfile, isLoading, isAuthenticated,
        signUp, signIn, signOut, refreshProfile, userRole, hasCompletedProfile, isRegistering, setIsRegistering,
        activeRole, setActiveRole, availableRoles, hasMultipleRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
