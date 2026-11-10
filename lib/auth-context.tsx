"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { hashPassword } from "./hash";
import {
  clearSession,
  deleteUser,
  loadSession,
  loadUsers,
  saveSession,
  saveUsers,
  uid,
} from "./store";
import type { LocalUser } from "./types";

type AuthContextValue = {
  user: LocalUser | null;
  ready: boolean;
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => void;
  updateProfile: (patch: { name?: string }) => void;
  deleteAccount: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (session) {
      const match = loadUsers().find((item) => item.id === session.userId);
      if (match) {
        setUser(match);
      } else {
        clearSession();
      }
    }
    setReady(true);
  }, []);

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const cleanName = name.trim();
      const cleanEmail = email.trim().toLowerCase();

      if (cleanName.length < 2) return "Please enter your name.";
      if (!EMAIL_PATTERN.test(cleanEmail)) return "Please enter a valid email address.";
      if (password.length < 6) return "Password must be at least 6 characters.";

      const users = loadUsers();
      if (users.some((item) => item.email === cleanEmail)) {
        return "An account with this email already exists on this browser.";
      }

      const newUser: LocalUser = {
        id: uid(),
        name: cleanName,
        email: cleanEmail,
        passwordHash: await hashPassword(cleanEmail, password),
        createdAt: new Date().toISOString(),
      };

      saveUsers([...users, newUser]);
      saveSession({ userId: newUser.id });
      setUser(newUser);
      return null;
    },
    []
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) return "Enter your email and password.";

    const users = loadUsers();
    const match = users.find((item) => item.email === cleanEmail);
    if (!match) return "No account found with that email on this browser.";

    const hash = await hashPassword(cleanEmail, password);
    if (hash !== match.passwordHash) return "Incorrect password. Try again.";

    saveSession({ userId: match.id });
    setUser(match);
    return null;
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const updateProfile = useCallback((patch: { name?: string }) => {
    if (!patch.name) return;
    setUser((current) => {
      if (!current) return current;
      const updated = { ...current, name: patch.name!.trim() || current.name };
      saveUsers(
        loadUsers().map((item) => (item.id === updated.id ? updated : item))
      );
      return updated;
    });
  }, []);

  const deleteAccount = useCallback(() => {
    setUser((current) => {
      if (current) {
        deleteUser(current.id);
        clearSession();
      }
      return null;
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      signUp,
      signIn,
      signOut,
      updateProfile,
      deleteAccount,
    }),
    [user, ready, signUp, signIn, signOut, updateProfile, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}
