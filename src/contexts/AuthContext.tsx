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

import {
  browserLocalPersistence,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

interface AuthContextValue {
  user: User | null;
  authorized: boolean;
  loading: boolean;
  signingIn: boolean;
  signingOut: boolean;
  checkingAuthorization: boolean;
  error: string | null;

  signInWithGoogle: () => Promise<boolean>;
  signOutUser: () => Promise<boolean>;
  refreshAuthorization: () => Promise<boolean>;
  clearError: () => void;
}

const AuthContext =
  createContext<AuthContextValue | null>(
    null,
  );

interface AuthProviderProps {
  children: ReactNode;
}

function getAuthErrorMessage(
  error: unknown,
): string {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";

  switch (code) {
    case "auth/popup-closed-by-user":
      return "Cerraste la ventana antes de completar el inicio de sesión.";

    case "auth/cancelled-popup-request":
      return "Ya existe otra solicitud de inicio de sesión abierta.";

    case "auth/network-request-failed":
      return "No se pudo conectar con Google. Revisa tu conexión.";

    case "auth/unauthorized-domain":
      return "Este dominio no está autorizado en Firebase Authentication.";

    case "auth/account-exists-with-different-credential":
      return "Esta cuenta ya utiliza otro método de inicio de sesión.";

    default:
      return "No se pudo iniciar sesión con Google.";
  }
}

function shouldUseRedirect(
  error: unknown,
): boolean {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";

  return (
    code === "auth/popup-blocked" ||
    code ===
      "auth/operation-not-supported-in-this-environment"
  );
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [
    user,
    setUser,
  ] =
    useState<User | null>(
      null,
    );

  const [
    authReady,
    setAuthReady,
  ] =
    useState(false);

  const [
    authorized,
    setAuthorized,
  ] =
    useState(false);

  const [
    checkingAuthorization,
    setCheckingAuthorization,
  ] =
    useState(false);

  const [
    signingIn,
    setSigningIn,
  ] =
    useState(false);

  const [
    signingOut,
    setSigningOut,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const checkAuthorization =
    useCallback(
      async (
        currentUser: User,
      ): Promise<boolean> => {
        setCheckingAuthorization(
          true,
        );

        setError(
          null,
        );

        try {
          const authorizationSnapshot =
            await getDoc(
              doc(
                db,
                "allowedUsers",
                currentUser.uid,
              ),
            );

          const isAuthorized =
            authorizationSnapshot.exists() &&
            authorizationSnapshot.data()
              .activo === true;

          if (
            auth.currentUser?.uid ===
            currentUser.uid
          ) {
            setAuthorized(
              isAuthorized,
            );
          }

          return isAuthorized;
        } catch (
          authorizationError
        ) {
          console.error(
            "No se pudo comprobar la autorización:",
            authorizationError,
          );

          if (
            auth.currentUser?.uid ===
            currentUser.uid
          ) {
            setAuthorized(
              false,
            );

            setError(
              "No se pudo comprobar si esta cuenta tiene acceso.",
            );
          }

          return false;
        } finally {
          setCheckingAuthorization(
            false,
          );
        }
      },
      [],
    );

  useEffect(() => {
    void getRedirectResult(
      auth,
    ).catch(
      (
        redirectError: unknown,
      ) => {
        console.error(
          "No se pudo completar el acceso redirigido:",
          redirectError,
        );

        setError(
          getAuthErrorMessage(
            redirectError,
          ),
        );
      },
    );

    const unsubscribe =
      onAuthStateChanged(
        auth,

        (
          currentUser,
        ) => {
          setUser(
            currentUser,
          );

          setAuthorized(
            false,
          );

          setAuthReady(
            true,
          );

          if (
            currentUser
          ) {
            void checkAuthorization(
              currentUser,
            );
          } else {
            setCheckingAuthorization(
              false,
            );
          }
        },

        (
          authStateError,
        ) => {
          console.error(
            "No se pudo recuperar la sesión:",
            authStateError,
          );

          setUser(
            null,
          );

          setAuthorized(
            false,
          );

          setAuthReady(
            true,
          );

          setCheckingAuthorization(
            false,
          );

          setError(
            "No se pudo recuperar la sesión guardada.",
          );
        },
      );

    return unsubscribe;
  }, [
    checkAuthorization,
  ]);

  const signInWithGoogle =
    useCallback(
      async (): Promise<boolean> => {
        setSigningIn(
          true,
        );

        setError(
          null,
        );

        try {
          await setPersistence(
            auth,
            browserLocalPersistence,
          );

          const provider =
            new GoogleAuthProvider();

          provider.setCustomParameters({
            prompt:
              "select_account",
          });

          try {
            await signInWithPopup(
              auth,
              provider,
            );

            return true;
          } catch (
            popupError
          ) {
            if (
              shouldUseRedirect(
                popupError,
              )
            ) {
              await signInWithRedirect(
                auth,
                provider,
              );

              return false;
            }

            throw popupError;
          }
        } catch (
          signInError
        ) {
          console.error(
            "No se pudo iniciar sesión:",
            signInError,
          );

          setError(
            getAuthErrorMessage(
              signInError,
            ),
          );

          return false;
        } finally {
          setSigningIn(
            false,
          );
        }
      },
      [],
    );

  const signOutUser =
    useCallback(
      async (): Promise<boolean> => {
        setSigningOut(
          true,
        );

        setError(
          null,
        );

        try {
          await signOut(
            auth,
          );

          return true;
        } catch (
          signOutError
        ) {
          console.error(
            "No se pudo cerrar la sesión:",
            signOutError,
          );

          setError(
            "No se pudo cerrar la sesión.",
          );

          return false;
        } finally {
          setSigningOut(
            false,
          );
        }
      },
      [],
    );

  const refreshAuthorization =
    useCallback(
      async (): Promise<boolean> => {
        const currentUser =
          auth.currentUser;

        if (
          !currentUser
        ) {
          setAuthorized(
            false,
          );

          return false;
        }

        return checkAuthorization(
          currentUser,
        );
      },
      [
        checkAuthorization,
      ],
    );

  const value =
    useMemo<AuthContextValue>(
      () => ({
        user,
        authorized,

        loading:
          !authReady ||
          checkingAuthorization,

        signingIn,
        signingOut,
        checkingAuthorization,
        error,

        signInWithGoogle,
        signOutUser,
        refreshAuthorization,

        clearError: () =>
          setError(
            null,
          ),
      }),
      [
        user,
        authorized,
        authReady,
        signingIn,
        signingOut,
        checkingAuthorization,
        error,
        signInWithGoogle,
        signOutUser,
        refreshAuthorization,
      ],
    );

  return (
    <AuthContext.Provider
      value={
        value
      }
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context =
    useContext(
      AuthContext,
    );

  if (
    !context
  ) {
    throw new Error(
      "useAuth debe utilizarse dentro de AuthProvider.",
    );
  }

  return context;
}